export function editorText(value: string, locale?: string): string;
export function localizeEventualBlocks(blocks: unknown[], locale: string): unknown[];
export function draftSummary(field: string, source: unknown, locale: string, timezone?: string): string;
export function fillFrenchCoreMessages(i18n: unknown): void;
/** Load the catalog for a UI locale (English needs none); editorText translates once it resolves. */
export function loadEditorCatalog(locale: string | undefined): Promise<void>;
/** Subscribe to catalog arrivals (to re-render); returns an unsubscribe function. */
export function onEditorCatalog(listener: () => void): () => void;
