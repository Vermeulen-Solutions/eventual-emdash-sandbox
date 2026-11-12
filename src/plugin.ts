import { pluginResponse, pluginRoute, type SandboxedPlugin } from "emdash/plugin";

import { handleAdmin } from "./admin";
import { localizeResponse } from "./ui/localize";
import { adminTranslator, warmLanguagePack } from "./ui/i18n";
import { withInvocationBudget } from "./domain/invocation-budget";
import type { EventualContext } from "./storage";
import { handleSavedSchedulePanel } from './native/saved-panel';
import { handlePublicEvents } from "./routes/public-events";
import { handlePublicEventImage } from "./routes/public-media";
import { handleCalendarFeed } from "./routes/calendar-feed";
import { mcpTools } from "./mcp-schemas";
import { mcpRoutes } from "./mcp";
import { transferRoutes } from './transfer';
import { EventScanLimitError } from "./storage";
import { handleContentBeforeSave, handleContentBeforeDelete, handleContentBeforePublish, handleContentBeforeUnpublish } from "./hooks/content-hooks";
import { SandboxBudgetError } from './domain/invocation-budget';

const unavailable = (error: Error) => pluginResponse({status: 503, headers: {'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store', 'retry-after':'60'}, body:{kind:'text',value:error.message}});

/** Localize after the handler, with whatever RPC budget the handler left (shared counter). */
async function localized<T extends Parameters<typeof localizeResponse>[0]>(ctx: EventualContext, locale: string | undefined, render: (ctx: EventualContext) => Promise<T>) {
	const budgeted = withInvocationBudget(ctx);
	const response = await render(budgeted);
	const translate = await adminTranslator(budgeted, locale);
	return translate ? localizeResponse(response, translate) : response;
}

const plugin: SandboxedPlugin = {
	hooks: {
		"plugin:activate": async (_event, ctx) => { await warmLanguagePack(ctx as EventualContext); },
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
            handler: async (routeCtx, ctx) => localized(ctx as EventualContext, routeCtx.ui?.locale, budgeted => handleAdmin(routeCtx.input, {...budgeted,site:{...budgeted.site,url:budgeted.site.url || new URL(routeCtx.request.url).origin}} as never, routeCtx.user)),
		},
		"admin/editor/schedule": {
			permission: "content:edit_any",
			handler: async (routeCtx,ctx) => localized(ctx as EventualContext, routeCtx.ui?.locale, budgeted => handleSavedSchedulePanel(routeCtx,budgeted as never)),
		},
		publicEvents: pluginRoute({
			public: true,
			methods: ["GET"],
			request: { body: "none" },
			cacheControl: "public, max-age=60",
			handler: async (routeCtx, ctx) => {
                const result = await handlePublicEvents(routeCtx.input, ctx);
                // JSON routes must throw transport failures, not return raw envelopes.
                if (result.error === 'SANDBOX_BUDGET_EXCEEDED') throw new SandboxBudgetError();
                return result;
            },
		}),
		publicEventImage: pluginRoute({
			public: true,
			methods: ["GET"],
			request: { body: "none" },
			response: "raw",
			cacheControl: "no-store",
			handler: async (routeCtx, ctx) => {
                try { return await handlePublicEventImage(routeCtx.input, ctx); }
                catch (error) { if (error instanceof SandboxBudgetError) return unavailable(error); throw error; }
            },
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
					return unavailable(error instanceof EventScanLimitError || error instanceof SandboxBudgetError ? error : new Error('Calendar feed unavailable; retry later.'));
				}
			},
		}),
	},
	mcp: { tools: mcpTools },
};

export default plugin;
