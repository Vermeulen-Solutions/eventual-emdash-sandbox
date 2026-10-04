export type Collection = 'events' | 'venues' | 'organizers';
export interface TransferRecord { sourceId: string; data: Record<string, unknown> }
export interface ConversionResult { records: TransferRecord[]; errors: Array<{ row: number; error: string }> }
export interface ImportRow { row: number; sourceId: string; id: string; status: 'ready' | 'imported' | 'skipped' | 'error'; error?: string; warnings?: string[] }
export interface ToolResult { ok?: boolean; error?: string; records?: TransferRecord[]; rows?: ImportRow[]; nextCursor?: string }
export type Invoke = (name: 'exportRecords' | 'previewImport' | 'importRecords', input: Record<string, unknown>) => Promise<ToolResult>;
export interface Backup { format: 'eventual-data'; version: 1; exportedAt: string; collections: Record<Collection, TransferRecord[]> }
export function parseCsv(text: string): string[][];
export function csvToRecords(text: string): ConversionResult;
export function icsToRecords(text: string): ConversionResult;
export function exportBackup(invoke: Invoke): Promise<Backup>;
export function transferRecords(invoke: Invoke, collection: Collection, records: TransferRecord[], options: { source: string; mode?: 'copy' | 'restore'; write?: boolean }): Promise<ImportRow[]>;
export function restoreBackup(invoke: Invoke, backup: Backup, options?: { source?: string; write?: boolean }): Promise<Record<Collection, ImportRow[]>>;
