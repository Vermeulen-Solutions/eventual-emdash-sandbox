import type { APIRoute } from "astro";
import { formatICalendar } from "../../lib/calendar";
import { eventRange } from "../../lib/event-range";
import { fetchPublicFeed } from "../../lib/feed";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
	const range = eventRange(url.searchParams);
	if (!range) return new Response("A valid event date range is required.", { status: 400 });

	try {
		const apiOrigin = process.env.EVENTUAL_API_ORIGIN || url.origin;
		const event = (await fetchPublicFeed(apiOrigin, range.from, range.through)).events
			.find((item) => item.id === (params.id ?? ""));
		if (!event) return new Response("Event not found.", { status: 404 });

		const body = formatICalendar(event, url.host);
		const filename = safeFileName(event.title) || "event";
		return new Response(body, {
			headers: {
				"content-type": "text/calendar; charset=utf-8",
				"content-disposition": `attachment; filename="${filename}.ics"`,
				"cache-control": "no-store",
			},
		});
	} catch {
		return new Response("The event feed could not be loaded.", { status: 502 });
	}
};

function safeFileName(value: string): string {
	return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}
