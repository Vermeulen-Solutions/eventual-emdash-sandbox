import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

// Exercise the actual built page, including Astro's HTML embedding behavior.
const payload = "</script><script>alert(1)</script>";
const event = {
	id: "security-check", title: payload, description: payload,
	start: "2026-10-10", end: "2026-10-10", allDay: true, timezone: "UTC",
	location: "Town hall", locationType: "hybrid", virtualUrl: "https://example.com/join",
	status: "cancelled", organizer: "", externalUrl: "", imageUrl: "/banner.png",
	categories: [], venue: null, directionsUrl: "",
};
const cms = createServer((_request, response) => {
	response.setHeader("content-type", "application/json");
	response.end(JSON.stringify({success: true, data: {ok: true, from: "2026-10-10", through: "2026-10-10", events: [event]}}));
});
let site;
try {
	cms.listen(0, "127.0.0.1");
	await once(cms, "listening");
	process.env.EVENTUAL_API_ORIGIN = `http://127.0.0.1:${cms.address().port}`;
	process.env.EVENTUAL_LOCALE = "fr";
	process.env.ASTRO_NODE_AUTOSTART = "disabled";
	const {handler} = await import("../dist/server/entry.mjs");
	site = createServer(handler);
	site.listen(0, "127.0.0.1");
	await once(site, "listening");
	const response = await fetch(`http://127.0.0.1:${site.address().port}/events/security-check?from=2026-10-10&through=2026-10-10`);
	assert.equal(response.status, 200);
	const html = await response.text();
	const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
	assert.equal(scripts.length, 1);
	assert(!scripts[0][1].includes("<"));
	assert(!html.includes("<script>alert(1)</script>"));
	const record = JSON.parse(scripts[0][1]);
	assert.equal(record.name, payload);
	assert.equal(record.location.length, 2);
	assert.equal(record.image, `${process.env.EVENTUAL_API_ORIGIN}/banner.png`);
	assert(html.includes('href="https://example.com/join"'));
	assert(html.includes("Annulé"));
	console.log("Built event page: JSON-LD escaping, hybrid locations, relative image URLs, safe meeting link, and localization passed.");
} finally {
	for (const server of [site, cms]) {
		if (!server) continue;
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
}
