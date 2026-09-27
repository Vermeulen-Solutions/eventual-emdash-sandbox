export function renderDescriptionMarkdown(source: string, headingBase = 2): string {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let list: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
		paragraph = [];
	};
	const flushList = () => {
		if (list.length === 0) return;
		blocks.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
		list = [];
	};

	for (const line of lines) {
		const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*$/);
		const item = line.match(/^\s*[-*]\s+(.+?)\s*$/);
		if (!line.trim()) {
			flushParagraph();
			flushList();
		} else if (heading) {
			flushParagraph();
			flushList();
			const level = Math.min(6, headingBase + heading[1]!.length - 1);
			blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
		} else if (item) {
			flushParagraph();
			list.push(item[1]!);
		} else {
			flushList();
			paragraph.push(line.trim());
		}
	}
	flushParagraph();
	flushList();
	return blocks.join("");
}

export function descriptionExcerpt(source: string, limit = 180): string {
	const plain = source
		.replace(/<[^>]*>/g, " ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/(^|\s)#{1,3}\s+/g, "$1")
		.replace(/\*\*|__|[*_]/g, "")
		.replace(/(^|\s)[-*]\s+/g, "$1")
		.replace(/\s+/g, " ")
		.trim();
	if (plain.length <= limit) return plain;
	const cut = plain.slice(0, limit + 1);
	const boundary = cut.lastIndexOf(" ");
	return `${cut.slice(0, boundary > limit * 0.7 ? boundary : limit).trimEnd()}…`;
}

function renderInline(source: string): string {
	let html = "";
	let index = 0;
	while (index < source.length) {
		const rest = source.slice(index);
		const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
		if (link) {
			const href = safeLink(link[2]!);
			html += href
				? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${renderInline(link[1]!)}</a>`
				: escapeHtml(link[0]);
			index += link[0].length;
			continue;
		}
		const strong = rest.match(/^\*\*(.+?)\*\*/);
		if (strong) {
			html += `<strong>${renderInline(strong[1]!)}</strong>`;
			index += strong[0].length;
			continue;
		}
		const emphasis = rest.match(/^_([^_]+?)_/);
		if (emphasis) {
			html += `<em>${renderInline(emphasis[1]!)}</em>`;
			index += emphasis[0].length;
			continue;
		}
		html += escapeHtml(source[index]!);
		index += 1;
	}
	return html;
}

function safeLink(value: string): string {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[character]!);
}

function escapeAttribute(value: string): string {
	return escapeHtml(value);
}
