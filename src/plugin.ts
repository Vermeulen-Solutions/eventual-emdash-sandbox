import { pluginResponse, pluginRoute, type SandboxedPlugin } from "emdash/plugin";
import type { BlockResponse } from "@emdash-cms/blocks";

import { handleAdmin } from "./native-admin";
import { handleScheduleEditorPanel } from "./native/schedule-panel";
import { handlePublicEvents } from "./routes/public-events";
import { handlePublicEventImage } from "./routes/public-media";
import { handleCalendarFeed } from "./routes/calendar-feed";
import { mcpTools } from "./mcp-schemas";
import { mcpRoutes } from "./mcp";
import { transferRoutes } from './transfer';
import { EventScanLimitError } from "./storage";
import { handleContentBeforeSave, handleContentBeforeDelete, handleContentBeforePublish, handleContentBeforeUnpublish } from "./hooks/content-hooks";
const editorUi = (response: BlockResponse) => {
  if (response.blocks[0]) response.blocks[0].block_id = "eventual-ui";
  return response;
};

const plugin: SandboxedPlugin = {
	hooks: {
		"content:beforeSave": handleContentBeforeSave,
		"content:beforeDelete": handleContentBeforeDelete,
		"content:beforePublish": handleContentBeforePublish,
		"content:beforeSchedule": handleContentBeforePublish,
		"content:beforeUnpublish": handleContentBeforeUnpublish,
	},
	routes: {
		...mcpRoutes,
		...transferRoutes,
		admin: {
			permission: "content:edit_any",
            handler: async (routeCtx, ctx) => editorUi(await handleAdmin(routeCtx.input, ctx, routeCtx.user)),
		},
		"admin/editor/schedule": {
			permission: "content:edit_any",
			handler: async (routeCtx, ctx) => editorUi(await handleScheduleEditorPanel(routeCtx, ctx)),
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
					const url = new URL(routeCtx.request.url, "http://localhost");
					const locale = url.searchParams.get("locale") || undefined;
					try { if (locale) Intl.getCanonicalLocales(locale); } catch {
						return pluginResponse({status:400,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'},body:{kind:'text',value:'Invalid locale.'}});
					}
					const strict = url.searchParams.get("strict") === "true";
					const category = url.searchParams.get("category") || undefined;
					const host = url.host || "localhost";
					return pluginResponse({
						status: 200,
						headers: { "content-type": "text/calendar; charset=utf-8" },
						body: {
							kind: "text",
							value: await handleCalendarFeed(ctx, host, { locale, strict, category }),
						},
					});
				} catch (error) {
					return pluginResponse({
						status: 503,
						headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
						body: { kind: "text", value: error instanceof EventScanLimitError ? error.message : 'Calendar feed unavailable; retry later.' },
					});
				}
			},
		}),
	},
	mcp: { tools: mcpTools },
};

export default plugin;
