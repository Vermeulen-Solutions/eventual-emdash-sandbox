import { describe, expect, it } from "vitest";
import {
	portableTextToPlainText,
	plainTextToPortableText,
	type PortableTextBlock,
} from "../src/domain/portable-text";

describe("portableTextToPlainText", () => {
	it("serializes standard paragraphs and headings", () => {
		const blocks: PortableTextBlock[] = [
			{
				_type: "block",
				style: "h2",
				children: [{ text: "Annual General Meeting" }],
			},
			{
				_type: "block",
				style: "normal",
				children: [{ text: "Please join us at the stadium." }],
			},
		];

		const result = portableTextToPlainText(blocks);
		expect(result).toBe("Annual General Meeting\n\nPlease join us at the stadium.");
	});

	it("serializes bullet lists", () => {
		const blocks: PortableTextBlock[] = [
			{
				_type: "block",
				listItem: "bullet",
				children: [{ text: "Bring equipment" }],
			},
			{
				_type: "block",
				listItem: "bullet",
				children: [{ text: "Arrive 15 minutes early" }],
			},
		];

		const result = portableTextToPlainText(blocks);
		expect(result).toBe("- Bring equipment\n\n- Arrive 15 minutes early");
	});

	it("preserves links with URLs", () => {
		const blocks: PortableTextBlock[] = [
			{
				_type: "block",
				style: "normal",
				markDefs: [{ _key: "link1", _type: "link", href: "https://example.com/signup" }],
				children: [
					{ text: "Register online: " },
					{ text: "Sign Up Here", marks: ["link1"] },
				],
			},
		];

		const result = portableTextToPlainText(blocks);
		expect(result).toBe("Register online: Sign Up Here (https://example.com/signup)");
	});

	it("handles raw string and json-encoded strings gracefully", () => {
		expect(portableTextToPlainText("Simple plain text")).toBe("Simple plain text");
		expect(portableTextToPlainText("<p>HTML paragraph</p>")).toBe("HTML paragraph");
		expect(portableTextToPlainText(null)).toBe("");
		expect(portableTextToPlainText(undefined)).toBe("");
	});
});

describe("plainTextToPortableText", () => {
	it("converts multi-paragraph markdown to Portable Text blocks", () => {
		const markdown = "# Title\n\n- Item 1\n\nParagraph text here.";
		const blocks = plainTextToPortableText(markdown);

		expect(blocks).toHaveLength(3);
		expect(blocks[0]!.style).toBe("h1");
		expect(blocks[0]!.children![0]!.text).toBe("Title");

		expect(blocks[1]!.listItem).toBe("bullet");
		expect(blocks[1]!.children![0]!.text).toBe("Item 1");

		expect(blocks[2]!.style).toBe("normal");
		expect(blocks[2]!.children![0]!.text).toBe("Paragraph text here.");
	});
});
