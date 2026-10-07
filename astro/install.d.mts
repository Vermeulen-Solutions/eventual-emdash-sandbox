import type { AstroIntegration } from "astro";
import type { EmDashConfig } from "emdash/astro";
export const testedVersions: Readonly<Record<string, string>>;
export const testedToolchain: Readonly<Record<string, string>>;
export function installedVersion(name: string): string;
export function checkEditorVersions(resolveVersion?: (name: string) => string): Record<string, string>;
export function checkToolchainVersions(resolveVersion?: (name: string) => string): Record<string, string>;
export function emdashWithEventual(options?: EmDashConfig): AstroIntegration;
export default emdashWithEventual;
