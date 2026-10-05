import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
	output: "server",
	adapter: node({ mode: "standalone" }),
	redirects: {
		"/": "/events",
	},
	env: {
		schema: {
			EVENTUAL_API_ORIGIN: envField.string({ context: "server", access: "secret", optional: true }),
			EVENTUAL_LOCALE: envField.string({ context: "server", access: "secret", default: "en-GB" }),
			EVENTUAL_DISPLAY_TIMEZONE: envField.string({ context: "server", access: "secret", default: "UTC" }),
		},
	},
});

