import { loadPack, textTranslator } from './locales/index.mjs';
import pack from './locales/manifest';
import { remainingRpcCalls, withInvocationBudget } from '../domain/invocation-budget';
import type { EventualContext } from '../storage';

export type Translate = (text: string) => string;

/**
 * Translator for the admin's language. English is built in; other languages come from the
 * pinned eventual-locales pack (KV, else one verified CDN download) using only the RPC calls
 * the request has left. Without budget or network the page stays English for this request.
 */
export async function adminTranslator(ctx: EventualContext, locale?: string): Promise<Translate | null> {
  const budgeted = withInvocationBudget(ctx);
  const catalog = await loadPack(budgeted as never, pack, locale, () => remainingRpcCalls(budgeted));
  return catalog ? textTranslator(catalog, locale) : null;
}

/** Download the site language's pack ahead of the first admin page that needs it. */
export async function warmLanguagePack(ctx: EventualContext): Promise<void> {
  await loadPack(ctx as never, pack, ctx.site?.locale);
}
