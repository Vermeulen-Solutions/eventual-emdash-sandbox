import { emdashPluginTest } from "@emdash-cms/plugin-test/config";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
	plugins: [emdashPluginTest()],
	test: {
		exclude: [...configDefaults.exclude, 'scripts/**'],
		// The EmDash test plugin builds the shared sandbox artifact for each
		// Cloudflare pool. Keep workers serial to avoid dist/ write races on Windows.
		fileParallelism: false,
		maxWorkers: 1,
	},
});
