export interface PortableTextSpan {
  _type?: string;
  _key?: string;
  text?: string;
  marks?: string[];
}
export interface PortableTextMarkDef {
  _key: string;
  _type: string;
  href?: string;
  [key: string]: unknown;
}
export interface PortableTextBlock {
  _type?: string;
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
  [key: string]: unknown;
}
function cleanHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(
      /<\/?(?:p|div|span|a|b|strong|em|i|ul|ol|li|h[1-6]|blockquote)(?:\s[^>]*)?>/gi,
      "",
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
export function portableTextToPlainText(input: unknown): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return portableTextToPlainText(parsed);
      } catch {}
    }
    return portableTextToPlainText(plainTextToPortableText(trimmed));
  }
  if (!Array.isArray(input)) return "";
  const lines: string[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object") continue;
    const block = value as PortableTextBlock;
    if (block._type && block._type !== "block") continue;
    const marks = new Map<string, string>();
    for (const mark of Array.isArray(block.markDefs) ? block.markDefs : [])
      if (
        mark &&
        typeof mark._key === "string" &&
        typeof mark.href === "string" &&
        /^(?:https?:|mailto:)/i.test(mark.href)
      )
        marks.set(mark._key, mark.href);
    const text = (Array.isArray(block.children) ? block.children : [])
      .map((child) => {
        if (!child || typeof child.text !== "string") return "";
        const href = (Array.isArray(child.marks) ? child.marks : [])
          .map((mark) => marks.get(mark))
          .find(Boolean);
        return (
          child.text +
          (href && !child.text.includes(href) ? " (" + href + ")" : "")
        );
      })
      .join("")
      .trim();
    if (text)
      lines.push(
        (block.listItem === "bullet"
          ? "- "
          : block.listItem === "number"
            ? "1. "
            : "") + text,
      );
  }
  return lines.join("\n\n");
}
/** Common Markdown constructs map to editable blocks; unsupported syntax stays literal.
 * The migration retains the original Markdown in legacy_metadata for lossless recovery.
 */
export function plainTextToPortableText(text: string): PortableTextBlock[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const blocks: PortableTextBlock[] = [];
  let paragraph: string[] = [];
  const add = (
    value: string,
    style = "normal",
    listItem?: string,
    level?: number,
  ) => {
    const key = "block_" + blocks.length;
    const marks: PortableTextMarkDef[] = [];
    const children: PortableTextSpan[] = [];
    const tokens =
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\x60([^\x60]+)\x60/g;
    let offset = 0;
    let match: RegExpExecArray | null;
    const span = (value: string, spanMarks: string[] = []) => {
      if (value)
        children.push({
          _type: "span",
          _key: key + "_" + children.length,
          text: value,
          marks: spanMarks,
        });
    };
    while ((match = tokens.exec(value))) {
      span(value.slice(offset, match.index));
      if (match[1] && match[2]) {
        const markKey = key + "_link_" + marks.length;
        marks.push({ _key: markKey, _type: "link", href: match[2] });
        span(match[1], [markKey]);
      } else
        span(match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7] ?? "", [
          match[3] || match[4] ? "strong" : match[7] ? "code" : "em",
        ]);
      offset = match.index + match[0].length;
    }
    span(value.slice(offset));
    blocks.push({
      _type: "block",
      _key: key,
      style,
      markDefs: marks,
      children,
      ...(listItem ? { listItem, level: level ?? 1 } : {}),
    });
  };
  const flush = () => {
    if (paragraph.length) add(paragraph.join("\n"));
    paragraph = [];
  };
  let fenced = false;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*\x60\x60\x60/.test(line)) {
      flush();
      fenced = !fenced;
      add(line);
      continue;
    }
    if (fenced) {
      add(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const list = /^(\s*)(?:([-*+])|\d+\.)\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (heading) {
      flush();
      add(heading[2]!, "h" + heading[1]!.length);
    } else if (list) {
      flush();
      add(
        list[3]!,
        "normal",
        list[2] ? "bullet" : "number",
        Math.floor(list[1]!.length / 2) + 1,
      );
    } else if (quote) {
      flush();
      add(quote[1]!, "blockquote");
    } else paragraph.push(cleanHtml(line));
  }
  flush();
  return blocks;
}
