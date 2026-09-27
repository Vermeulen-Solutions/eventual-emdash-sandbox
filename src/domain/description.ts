/** The small formatting vocabulary supported by the sandbox description editor. */
export type DescriptionBlockStyle = "paragraph" | "heading" | "bullet" | "bold" | "italic";
export interface DescriptionBlock {
	style: DescriptionBlockStyle;
	text: string;
}

export const MAX_DESCRIPTION_BLOCKS = 12;
const STYLES = ["paragraph", "heading", "bullet", "bold", "italic"];

function decodeText(value: string): string {
	return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
		if (code[0] === "#") {
			const numeric = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
			return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff && !(numeric >= 0xd800 && numeric <= 0xdfff)
				? String.fromCodePoint(numeric) : "�";
		}
		return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0" } as Record<string, string>)[code.toLowerCase()] ?? entity;
	});
}

function inlineText(value: string): string | null {
	const text = value.replace(/<br\s*\/?\s*>/gi, "\n");
	return /[<>]/.test(text) ? null : decodeText(text);
}

/** Reopen our own HTML output. Unsupported markup is left untouched, never flattened. */
export function readDescription(description: string): { blocks: DescriptionBlock[]; editable: boolean } {
	if (!description.trim()) return { blocks: [], editable: true };
	if (!/<\/?[a-z!][^>]*>/i.test(description)) {
		return { blocks: [{ style: "paragraph", text: description }], editable: description.length <= 5000 };
	}
	const blocks: DescriptionBlock[] = [];
	let end = 0;
	for (const match of description.matchAll(/<(p|h3|ul)>([\s\S]*?)<\/\1>/g)) {
		if (description.slice(end, match.index).trim()) return { blocks: [], editable: false };
		end = match.index + match[0].length;
		const tag = match[1]!;
		let body = match[2]!;
		let style: DescriptionBlockStyle = tag === "h3" ? "heading" : tag === "ul" ? "bullet" : "paragraph";
		let text: string | null;
		if (tag === "ul") {
			const items: string[] = [];
			let listEnd = 0;
			for (const item of body.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
				const content = inlineText(item[1]!);
				if (body.slice(listEnd, item.index).trim() || content === null || content.includes("\n")) return { blocks: [], editable: false };
				items.push(content);
				listEnd = item.index + item[0].length;
			}
			if (!items.length || body.slice(listEnd).trim() || items.length > 100) return { blocks: [], editable: false };
			text = items.join("\n");
		} else {
			const emphasis = /^<(strong|em)>([\s\S]*)<\/\1>$/.exec(body);
			if (tag === "p" && emphasis) {
				style = emphasis[1] === "strong" ? "bold" : "italic";
				body = emphasis[2]!;
			}
			text = inlineText(body);
		}
		if (text === null || text.length > 5000) return { blocks: [], editable: false };
		blocks.push({ style, text });
	}
	return description.slice(end).trim() || !blocks.length || blocks.length > MAX_DESCRIPTION_BLOCKS
		? { blocks: [], editable: false } : { blocks, editable: true };
}

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Safely serialize an ordered description. A complete list occupies one section. */
export function blocksToDescription(value: unknown): { description?: string; error?: string } {
	if (!Array.isArray(value) || value.length > MAX_DESCRIPTION_BLOCKS) return { error: `A description can have up to ${MAX_DESCRIPTION_BLOCKS} sections.` };
	const html: string[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null || Array.isArray(item)) return { error: "Check the description text and formatting." };
		const block = item as Record<string, unknown>;
		if (typeof block.text !== "string" || typeof block.style !== "string" || !STYLES.includes(block.style)) return { error: "Choose a valid format and enter ordinary text." };
		if (block.text.length > 5000) return { error: "Keep each section to 5,000 characters or fewer. Split longer text into another paragraph." };
		const text = block.text.replace(/\r\n?/g, "\n").trim();
		if (!text) continue;
		if (block.style === "bullet") {
			const items = text.split("\n").map((line) => line.trim()).filter(Boolean);
			if (items.length > 100) return { error: "A list can have up to 100 items. Split longer lists into another section." };
			html.push(`<ul>${items.map((line) => `<li>${escapeText(line)}</li>`).join("")}</ul>`);
			continue;
		}
		const content = escapeText(text).replace(/\n/g, "<br>");
		if (block.style === "heading") html.push(`<h3>${content}</h3>`);
		else if (block.style === "bold") html.push(`<p><strong>${content}</strong></p>`);
		else if (block.style === "italic") html.push(`<p><em>${content}</em></p>`);
		else html.push(`<p>${content}</p>`);
	}
	const description = html.join(" ");
	return new TextEncoder().encode(description).byteLength > 60000
		? { error: "The description is too long. Shorten it before saving." } : { description };
}

export function descriptionInput(values: Record<string, unknown>): { block?: DescriptionBlock; error?: string } {
	if (typeof values.text !== "string" || !values.text.trim()) return { error: "Enter some text, or choose Cancel to return to the description." };
	if (typeof values.kind !== "string" || !["paragraph", "heading", "bullet"].includes(values.kind)) return { error: "Choose Paragraph, Heading, or Bullet list." };
	if (values.kind === "paragraph" && (typeof values.emphasis !== "string" || !["normal", "bold", "italic"].includes(values.emphasis))) return { error: "Choose Normal, Bold, or Italic text." };
	const style = values.kind === "paragraph" && values.emphasis !== "normal" ? values.emphasis : values.kind;
	const block = { style: style as DescriptionBlockStyle, text: values.text };
	const result = blocksToDescription([block]);
	return result.error ? { error: result.error } : { block };
}
