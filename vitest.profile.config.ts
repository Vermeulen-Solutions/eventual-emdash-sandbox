import { defineConfig } from 'vitest/config';

// Run the same deterministic call assertions in Node to write diagnostic reports.
export default defineConfig({ test: { include: ['tests/performance.test.ts'], env: { EVENTUAL_PROFILE_REPORT: '1' } } });
