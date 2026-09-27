import { describe, expect, it } from "vitest";
import { blocksToDescription, descriptionInput, MAX_DESCRIPTION_BLOCKS, readDescription } from "../src/domain/description";

describe("formatted descriptions", () => {
	it("reopens a whole list in one textbox, preserving text and emphasis", () => {
		const blocks = [
			{ style: "paragraph", text: "Ouverts à tous\nVenez avec votre imagination !" },
			{ style: "bold", text: "Aucune inscription nécessaire" },
			{ style: "bullet", text: "7 septembre 2026\n21 septembre 2026" },
		];
		const { description } = blocksToDescription(blocks);
		expect(description).toBe("<p>Ouverts à tous<br>Venez avec votre imagination !</p> <p><strong>Aucune inscription nécessaire</strong></p> <ul><li>7 septembre 2026</li><li>21 septembre 2026</li></ul>");
		expect(readDescription(description!)).toEqual({ editable: true, blocks });
	});

	it("escapes typed markup and safely reopens special characters", () => {
		const text = 'A < B & "everyone" 🎨';
		const { description } = blocksToDescription([{ style: "paragraph", text }]);
		expect(description).toBe("<p>A &lt; B &amp; &quot;everyone&quot; 🎨</p>");
		expect(readDescription(description!).blocks[0]?.text).toBe(text);
		expect(blocksToDescription([{ style: "bullet", text: "<script>alert(1)</script>\r\n\r\nSecond item" }]).description)
			.toBe("<ul><li>&lt;script&gt;alert(1)&lt;/script&gt;</li><li>Second item</li></ul>");
	});

	it("keeps unsupported imported formatting and overflow read-only instead of losing content", () => {
		for (const description of ["<p>Some <strong>inline</strong> emphasis</p>", '<p><a href="https://example.com">Link</a></p>', "<p>Keep me</p>Trailing text", "<p>Text</p>".repeat(MAX_DESCRIPTION_BLOCKS + 1)]) {
			expect(readDescription(description).editable).toBe(false);
		}
	});

	it("validates input, content limits, and clearing the final section", () => {
		expect(descriptionInput({ kind: "paragraph", emphasis: "normal", text: "" }).error).toContain("Enter some text");
		expect(descriptionInput({ kind: "html", text: "Text" }).error).toBeDefined();
		expect(descriptionInput({ kind: "paragraph", emphasis: "script", text: "Text" }).error).toBeDefined();
		expect(blocksToDescription([{ style: "paragraph", text: "x".repeat(5001) }]).error).toContain("5,000");
		expect(blocksToDescription([{ style: "bullet", text: Array(101).fill("Item").join("\n") }]).error).toContain("100 items");
		expect(blocksToDescription(Array(3).fill({ style: "paragraph", text: "&".repeat(5000) })).error).toContain("too long");
		expect(blocksToDescription([])).toEqual({ description: "" });
	});
});
