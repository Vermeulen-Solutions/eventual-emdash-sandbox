import { readFileSync, writeFileSync } from 'node:fs';
import { csvToRecords, icsToRecords } from '../transfer/index.mjs';

const [format, input, output] = process.argv.slice(2);
if (!['csv', 'ics'].includes(format) || !input || !output || input === output) throw new Error('Usage: node scripts/convert-import.mjs csv|ics input-file output-file (distinct paths)');
const result = (format === 'csv' ? csvToRecords : icsToRecords)(readFileSync(input, 'utf8'));
// Exclusive creation protects an existing export or input file.
writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(`${result.records.length} records; ${result.errors.length} conversion errors. Run previewImport before importing.`);
if (result.errors.length) process.exitCode = 1;
