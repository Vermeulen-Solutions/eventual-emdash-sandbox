import { emdashPluginTest } from "@emdash-cms/plugin-test/config";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
	plugins: [emdashPluginTest()],
	test: {
		include: ['tests/**/*.test.ts'],
		exclude: [...configDefaults.exclude, 'scripts/**', 'reports/**', 'tests/browser/**'],
		// The EmDash test plugin builds the shared sandbox artifact for each
		// Cloudflare pool. Keep workers serial to avoid dist/ write races on Windows.
		fileParallelism: false,
		maxWorkers: 1,
		// Production D1 host setup and policy RPCs can exceed Vitest's 5s default.
		testTimeout: 15_000,
	},
});
