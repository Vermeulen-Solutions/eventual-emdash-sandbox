import { emdashPluginTest } from "@emdash-cms/plugin-test/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [emdashPluginTest()],
	test: {
		// The EmDash test plugin builds the shared sandbox artifact for each
		// Cloudflare pool. Keep workers serial to avoid dist/ write races on Windows.
		fileParallelism: false,
		maxWorkers: 1,
	},
});
