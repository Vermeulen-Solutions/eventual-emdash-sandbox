import type { APIRoute } from "astro";
import { eventIdFromRoute, formatICalendar } from "../../lib/calendar";
import { eventRange } from "../../lib/event-range";
import { fetchPublicFeed } from "../../lib/feed";
import { EVENTUAL_API_ORIGIN } from "astro:env/server";

export const GET: APIRoute = async ({ params, url }) => {
	const range = eventRange(url.searchParams);
	if (!range) return new Response("A valid event date range is required.", { status: 400 });

	try {
		const apiOrigin = EVENTUAL_API_ORIGIN || url.origin;
		const eventId = eventIdFromRoute(params.id);
		const event = (await fetchPublicFeed(apiOrigin, range.from, range.through)).events
			.find((item) => item.id === eventId);
		if (!event) return new Response("Event not found.", { status: 404 });

		const body = formatICalendar(event, url.host);
		const filename = safeFileName(event.title) || "event";
		const subscription = url.searchParams.get("ical") === "1";
		return new Response(body, {
			headers: {
				"content-type": "text/calendar; charset=utf-8",
				...(subscription ? {} : { "content-disposition": `attachment; filename="${filename}.ics"` }),
				"cache-control": subscription ? "public, max-age=300" : "no-store",
			},
		});
	} catch {
		return new Response("The event feed could not be loaded.", { status: 502 });
	}
};

function safeFileName(value: string): string {
	return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}
