import pkg from "../package.json" with { type: "json" };
export function eventualEditor(version = pkg.version) {
  return { id: "eventual-editor", version, format: "native", entrypoint: "eventual/admin", adminEntry: "eventual/admin" };
}
export function createPlugin() {
  return { id: "eventual-editor", version: pkg.version, capabilities: [], allowedHosts: [], storage: {}, hooks: {}, routes: {}, admin: {} };
}
