/**
 * Keep published registry images inside EmDash's 1 MB artifact cap.
 *
 * EmDash's admin artifact proxy refuses image responses of 1 MiB or more
 * (`MAX_IMAGE_BYTES` in its registry artifact route), while the plugin
 * registry CDN derives every preset by resizing into a fixed box and encoding
 * lossless WebP. The derived bytes decide, not the source file: a 133 KB JPEG
 * upscaled to 2000 px lossless exceeded the cap and broke the admin gallery of
 * releases 0.11.0 through 0.13.3 (see the 0.13.4 release notes).
 *
 * Local mode (default) estimates each derivative from the manifest files with
 * sharp, which calibrated against cdn.em-da.sh on 2026-10-11 within 2.2% of the
 * real bytes for screenshots and 7.9% under for the grainy banner upscale, and
 * applies SAFETY_FACTOR headroom beyond the worst observed drift.
 * `--published <version>` re-checks the real CDN bytes of a published release
 * record instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";
import sharp from "sharp";

/** EmDash refuses artifact responses at or above this many bytes. */
export const LIMIT_BYTES = 1024 * 1024;
/** Headroom for encoder drift between sharp/libvips here and the CDN. */
export const SAFETY_FACTOR = 1.15;
/** Fraction of the cap that passes with a warning instead of failing. */
export const WARN_RATIO = 0.9;

/**
 * Registry CDN presets as observed on cdn.em-da.sh: lossless WebP, aspect
 * preserved, scale-to-fit boxes that also upscale smaller sources.
 * `feed_fullsize` is registry-site-only and is always smaller than the
 * `feed_thumbnail` derivative of the same artwork, so it needs no separate check.
 */
export const PRESETS = {
	icon: { preset: "avatar", box: { width: 1000, height: 1000 } },
	banner: { preset: "banner", box: { width: 3000, height: 1000 } },
	screenshot: { preset: "feed_thumbnail", box: { width: 2000, height: 2000 } },
};

/** Target dimensions for a source image: fit inside the preset box, upscaling allowed. */
export function presetTarget(kind, width, height) {
	const entry = PRESETS[kind];
	if (!entry) throw new Error(`Unknown artifact kind: ${kind}`);
	const scale = Math.min(entry.box.width / width, entry.box.height / height);
	return { preset: entry.preset, width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Classify an estimated derivative size against the cap. */
export function classify(estimatedBytes, limit = LIMIT_BYTES) {
	const ratio = (estimatedBytes * SAFETY_FACTOR) / limit;
	return { ratio, status: ratio > 1 ? "violation" : ratio > WARN_RATIO ? "warn" : "ok" };
}

/** Read the artifact image files declared for the next release. */
export function manifestArtifacts(manifestPath = "emdash-plugin.jsonc") {
	const errors = [];
	const manifest = parse(readFileSync(manifestPath, "utf8"), errors, { allowTrailingComma: true });
	if (errors.length) throw new Error(`${manifestPath}: invalid JSONC`);
	const artifacts = manifest?.release?.artifacts ?? {};
	const entries = [];
	if (artifacts.icon?.file) entries.push({ kind: "icon", file: artifacts.icon.file });
	if (artifacts.banner?.file) entries.push({ kind: "banner", file: artifacts.banner.file });
	for (const shot of artifacts.screenshots ?? []) if (shot?.file) entries.push({ kind: "screenshot", file: shot.file });
	return { publisher: manifest.publisher, slug: manifest.slug, entries };
}

/** Estimate one declared artifact's derivative the way the CDN derives it. */
export async function estimate(root, entry) {
	const path = resolve(root, entry.file);
	if (!existsSync(path)) throw new Error(`Missing artifact file: ${entry.file}`);
	const source = sharp(path);
	const metadata = await source.metadata();
	const target = presetTarget(entry.kind, metadata.width, metadata.height);
	const encoded = await source
		.resize({ width: target.width, height: target.height, fit: "fill" })
		.webp({ lossless: true, effort: 4 })
		.toBuffer();
	return {
		...entry,
		source: { width: metadata.width, height: metadata.height },
		target,
		estimatedBytes: encoded.length,
		...classify(encoded.length),
	};
}

/** Local pre-publish check over the manifest's declared artifacts. */
export async function checkLocal(manifestPath = "emdash-plugin.jsonc") {
	const { entries } = manifestArtifacts(manifestPath);
	const checked = [];
	for (const entry of entries) checked.push(await estimate(process.cwd(), entry));
	return {
		mode: "local",
		limitBytes: LIMIT_BYTES,
		safetyFactor: SAFETY_FACTOR,
		checked,
		violations: checked.filter(item => item.status === "violation"),
		warnings: checked.filter(item => item.status === "warn"),
	};
}

/**
 * Ground-truth check of a published release: resolve the record from the
 * publisher's PDS and measure the CDN derivatives named by its blobs.
 * Both namespaces and cdn.em-da.sh match the current experimental registry.
 */
export async function checkPublished(version, options = {}) {
	const manifestPath = options.manifestPath ?? "emdash-plugin.jsonc";
	const cdn = (options.cdn ?? "https://cdn.em-da.sh").replace(/\/+$/, "");
	const { publisher, slug } = manifestArtifacts(manifestPath);
	const document = await (await fetch(`https://plc.directory/${publisher}`)).json();
	const pds = document.service?.find(service => service.id === "#atproto_pds")?.serviceEndpoint;
	if (!pds) throw new Error(`No PDS service in the DID document for ${publisher}`);
	const collection = "com.emdashcms.experimental.package.release";
	const rkey = `${slug}:${version}`;
	const parameters = new URLSearchParams({ repo: publisher, collection, rkey });
	const record = await (await fetch(`${pds.replace(/\/+$/, "")}/xrpc/com.atproto.repo.getRecord?${parameters}`)).json();
	if (!record?.value?.artifacts) throw new Error(`No release record at ${rkey}`);
	const images = [];
	const add = (kind, label, artifact) => {
		const blob = artifact?.blob?.ref?.$link;
		if (blob) images.push({ kind, label, blob });
	};
	add("icon", "icon", record.value.artifacts.icon);
	add("banner", "banner", record.value.artifacts.banner);
	for (const [index, shot] of (record.value.artifacts.screenshots ?? []).entries()) add("screenshot", `screenshot[${index}]`, shot);
	const checked = [];
	for (const image of images) {
		const preset = PRESETS[image.kind].preset;
		const url = `${cdn}/img/${preset}/r/${publisher}/${collection}/${rkey}/${record.cid}/${image.blob}`;
		let item;
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const bytes = (await response.arrayBuffer()).byteLength;
			item = {
				...image,
				preset,
				url,
				bytes,
				status: bytes >= LIMIT_BYTES ? "violation" : bytes > LIMIT_BYTES * WARN_RATIO ? "warn" : "ok",
			};
		} catch (error) {
			item = { ...image, preset, url, error: String(error?.message ?? error), status: "violation" };
		}
		checked.push(item);
	}
	return {
		mode: "published",
		version,
		limitBytes: LIMIT_BYTES,
		cdn,
		checked,
		violations: checked.filter(item => item.status === "violation"),
		warnings: checked.filter(item => item.status === "warn"),
	};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const versionIndex = process.argv.indexOf("--published");
	const cdnIndex = process.argv.indexOf("--cdn");
	const options = cdnIndex === -1 ? {} : { cdn: process.argv[cdnIndex + 1] };
	const report =
		versionIndex === -1
			? await checkLocal()
			: await checkPublished(process.argv[versionIndex + 1] ?? "", options);
	console.log(JSON.stringify(report, null, 2));
	if (report.violations.length) process.exitCode = 1;
}
