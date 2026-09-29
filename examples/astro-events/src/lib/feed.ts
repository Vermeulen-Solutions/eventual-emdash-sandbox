// The example lives inside the plugin repository, so its Worker test harness
// cannot resolve the package's own `eventual/astro` self-reference. Consumers
// should import `eventual/astro`; the example uses the same source module.
export * from "../../../../astro/feed";
