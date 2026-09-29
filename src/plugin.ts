import { pluginResponse, pluginRoute, type SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { handlePublicEvents } from "./routes/public-events";
import { handlePublicEventImage } from "./routes/public-media";
import { handleCalendarFeed } from "./routes/calendar-feed";
import { mcpTools } from "./mcp-schemas";
import { mcpRoutes } from "./mcp";
import { EventScanLimitError } from "./storage";

const plugin: SandboxedPlugin = {
	routes: {
		...mcpRoutes,
		admin: {
			permission: "plugins:manage",
			handler: async (routeCtx, ctx) => handleAdmin(routeCtx.input, ctx),
		},
		publicEvents: pluginRoute({
			public: true,
			methods: ["GET"],
			request: { body: "none" },
			cacheControl: "public, max-age=60",
			handler: async (routeCtx, ctx) => handlePublicEvents(routeCtx.input, ctx),
		}),
		publicEventImage: pluginRoute({
			public: true,
			methods: ["GET"],
			request: { body: "none" },
			response: "raw",
			cacheControl: "no-store",
			handler: async (routeCtx, ctx) => handlePublicEventImage(routeCtx.input, ctx),
		}),
		calendar: pluginRoute({
			public: true,
			methods: ["GET"],
			request: { body: "none" },
			response: "raw",
			cacheControl: "public, max-age=300",
			handler: async (routeCtx, ctx) => {
				try {
					return pluginResponse({
						status: 200,
						headers: { "content-type": "text/calendar; charset=utf-8" },
						body: { kind: "text", value: await handleCalendarFeed(ctx, new URL(routeCtx.request.url).host) },
					});
				} catch (error) {
					if (!(error instanceof EventScanLimitError)) throw error;
					return pluginResponse({
						status: 503,
						headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
						body: { kind: "text", value: error.message },
					});
				}
			},
		}),
	},
	mcp: { tools: mcpTools },
};

export default plugin;
