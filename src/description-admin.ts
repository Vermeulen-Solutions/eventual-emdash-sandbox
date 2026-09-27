import type { BlockResponse, ButtonElement } from "@emdash-cms/blocks";
import { blocksToDescription, descriptionInput, MAX_DESCRIPTION_BLOCKS, readDescription, type DescriptionBlock } from "./domain/description";
import type { EventRecord } from "./domain/event";
import { getEvent, putEvent, type EventualContext } from "./storage";

type Interaction =
	| { type: "block_action"; action_id: string; value?: unknown }
	| { type: "form_submit"; action_id: string; block_id?: string; values: Record<string, unknown> };

interface Identity {
	eventId: string;
	revision: string;
	/** -1 adds a section; -2 replaces an unsupported description. */
	index: number;
}

interface FormDraft {
	kind: string;
	emphasis: string;
	text: string;
}

const LABELS = { paragraph: "Paragraph", heading: "Heading", bullet: "Bullet list", bold: "Bold paragraph", italic: "Italic paragraph" };

function identityValue(value: unknown): Identity | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const item = value as Record<string, unknown>;
	return typeof item.eventId === "string" && item.eventId.length > 0 && item.eventId.length <= 128
		&& typeof item.revision === "string" && item.revision.length <= 64
		&& typeof item.index === "number" && Number.isInteger(item.index) && item.index >= -2 && item.index < MAX_DESCRIPTION_BLOCKS
		? item as unknown as Identity : null;
}

function formIdentity(blockId?: string): Identity | null {
	if (!blockId?.startsWith("description-section:")) return null;
	try { return identityValue(JSON.parse(blockId.slice("description-section:".length))); } catch { return null; }
}

function identity(event: EventRecord, index: number): Identity {
	return { eventId: event.id, revision: event.updatedAt, index };
}

function button(action_id: string, label: string, value: unknown, style?: ButtonElement["style"]): ButtonElement {
	return { type: "button", action_id, label, value, ...(style ? { style } : {}) };
}

function clipped(text: string): string {
	return text.length > 350 ? `${text.slice(0, 350).trimEnd()}…` : text;
}

function overview(event: EventRecord, error?: string): BlockResponse {
	const content = readDescription(event.description);
	const blocks: BlockResponse["blocks"] = [
		{ type: "header", text: "Description" },
		{ type: "context", text: event.title },
	];
	if (error) blocks.push({ type: "banner", title: "Description not changed", description: error, variant: "error" });
	if (!content.editable) {
		blocks.push(
			{ type: "context", text: "This description uses formatting this editor cannot edit. Its existing content is preserved. You can write a replacement below." },
			{ type: "actions", elements: [button("description-replace", "Write replacement", identity(event, -2))] },
		);
	} else if (!content.blocks.length) {
		blocks.push({ type: "empty", title: "Write your event description", description: "Start with a paragraph, then add a heading or list if you need one." });
	} else {
		blocks.push({ type: "context", text: "Edit any section below. Additions and changes are saved when you submit their text." });
		content.blocks.forEach((block, index) => {
			const value = identity(event, index);
			blocks.push({ type: "context", text: LABELS[block.style] });
			if (block.style === "heading") blocks.push({ type: "header", text: clipped(block.text) });
			else if (block.style === "bullet") {
				const items = block.text.split("\n");
				blocks.push(...items.slice(0, 6).map((text) => ({ type: "section" as const, text: `• ${clipped(text)}` })));
				if (items.length > 6) blocks.push({ type: "context", text: `${items.length - 6} more items. Choose Edit list to see all items.` });
			} else blocks.push({ type: "section", text: clipped(block.text) });
			blocks.push({ type: "actions", elements: [
				button("description-edit", block.style === "bullet" ? "Edit list" : "Edit", value),
				...(index > 0 ? [button("description-up", "Move up", value)] : []),
				...(index < content.blocks.length - 1 ? [button("description-down", "Move down", value)] : []),
				{ ...button("description-remove", "Remove", value, "danger"), confirm: {
					title: `Remove this ${block.style === "bullet" ? "list" : block.style === "heading" ? "heading" : "paragraph"}?`,
					text: "This removes the section from the saved event description.", confirm: "Remove", deny: "Cancel", style: "danger",
				} },
			] });
			blocks.push({ type: "divider" });
		});
	}
	if (content.editable && content.blocks.length < MAX_DESCRIPTION_BLOCKS) blocks.push({ type: "actions", elements: [
		button("description-add-paragraph", "Add paragraph", identity(event, -1), "primary"),
		button("description-add-heading", "Add heading", identity(event, -1)),
		button("description-add-list", "Add list", identity(event, -1)),
	] });
	if (content.editable && content.blocks.length === MAX_DESCRIPTION_BLOCKS) blocks.push({ type: "context", text: "All 12 sections are in use. Edit an existing paragraph to add more text, or remove a section first." });
	blocks.push({ type: "actions", elements: [button("edit-event", "Done — back to event", event.id)] });
	return { blocks };
}

function editor(event: EventRecord, target: Identity, draft: FormDraft, error?: string): BlockResponse {
	const adding = target.index === -1;
	const replacing = target.index === -2;
	const blocks: BlockResponse["blocks"] = [
		{ type: "header", text: replacing ? "Write a new description" : adding ? "Add to description" : "Edit description" },
		{ type: "context", text: event.title },
		{ type: "context", text: replacing ? "The current description is kept until you save this replacement." : "Write ordinary text. For a list, enter one item per line." },
	];
	if (error) blocks.push({ type: "banner", title: "Text not saved", description: error, variant: "error" });
	blocks.push({
		type: "form", block_id: `description-section:${JSON.stringify(target)}`,
		fields: [
			{ type: "select", action_id: "kind", label: "Format", options: [
				{ label: "Paragraph", value: "paragraph" }, { label: "Heading", value: "heading" }, { label: "Bullet list", value: "bullet" },
			], initial_value: draft.kind },
			{ type: "text_input", action_id: "text", label: "Text", multiline: true, initial_value: draft.text, placeholder: "Write your text here. For a list, use one line per item." },
			{ type: "radio", action_id: "emphasis", label: "Paragraph style", options: [
				{ label: "Normal", value: "normal" }, { label: "Bold", value: "bold" }, { label: "Italic", value: "italic" },
			], initial_value: draft.emphasis, condition: { field: "kind", eq: "paragraph" } },
		],
		submit: { label: replacing ? "Replace description" : adding ? "Add to description" : "Save changes", action_id: "save-description-section" },
	}, { type: "actions", elements: [button("edit-description", "Cancel", event.id)] });
	return { blocks };
}

function draftForBlock(block: DescriptionBlock): FormDraft {
	return { kind: block.style === "bold" || block.style === "italic" ? "paragraph" : block.style, emphasis: block.style === "bold" || block.style === "italic" ? block.style : "normal", text: block.text };
}

function submittedDraft(values: Record<string, unknown>): FormDraft {
	return {
		kind: ["paragraph", "heading", "bullet"].includes(String(values.kind)) ? String(values.kind) : "paragraph",
		emphasis: ["normal", "bold", "italic"].includes(String(values.emphasis)) ? String(values.emphasis) : "normal",
		text: typeof values.text === "string" ? values.text.slice(0, 16000) : "",
	};
}

async function saveBlocks(ctx: EventualContext, event: EventRecord, blocks: DescriptionBlock[]): Promise<BlockResponse> {
	const result = blocksToDescription(blocks);
	if (result.description === undefined) return overview(event, result.error);
	const updated = { ...event, description: result.description, updatedAt: new Date(Math.max(Date.now(), Date.parse(event.updatedAt) + 1 || 0)).toISOString() };
	await putEvent(ctx, updated);
	return { ...overview(updated), toast: { message: "Description saved", type: "success" } };
}

export async function handleDescriptionAdmin(interaction: Interaction, ctx: EventualContext): Promise<BlockResponse | null> {
	if (interaction.type === "block_action" && interaction.action_id === "edit-description") {
		const event = typeof interaction.value === "string" ? await getEvent(ctx, interaction.value) : null;
		return event ? overview(event) : { blocks: [{ type: "banner", title: "Event no longer exists", variant: "error" }] };
	}
	const submitting = interaction.type === "form_submit" && interaction.action_id === "save-description-section";
	const action = interaction.action_id;
	if (!submitting && !(interaction.type === "block_action" && ["description-add-paragraph", "description-add-heading", "description-add-list", "description-edit", "description-up", "description-down", "description-remove", "description-replace"].includes(action))) return null;
	const target = interaction.type === "form_submit" ? formIdentity(interaction.block_id) : identityValue(interaction.value);
	const event = target ? await getEvent(ctx, target.eventId) : null;
	if (!target || !event) return { blocks: [{ type: "banner", title: "Description is no longer available", variant: "error" }] };
	const content = readDescription(event.description);
	if (event.updatedAt !== target.revision) {
		const message = "This event changed while you were editing. Your changes have not been saved. Return to the description and review its latest version.";
		return interaction.type === "form_submit" ? editor(event, target, submittedDraft(interaction.values), message) : overview(event, message);
	}
	if (submitting && interaction.type === "form_submit") {
		const draft = submittedDraft(interaction.values);
		const parsed = descriptionInput(interaction.values);
		if (!parsed.block) return editor(event, target, draft, parsed.error);
		if (target.index !== -2 && !content.editable) return overview(event, "The current description cannot be edited with these controls. Write a replacement instead.");
		const blocks = target.index === -2 ? [] : [...content.blocks];
		if (target.index === -1 || target.index === -2) blocks.push(parsed.block);
		else if (blocks[target.index]) blocks[target.index] = parsed.block;
		else return overview(event, "This section no longer exists. Choose another section to edit.");
		const result = blocksToDescription(blocks);
		return result.error ? editor(event, target, draft, result.error) : saveBlocks(ctx, event, blocks);
	}
	if (action === "description-replace") return editor(event, { ...target, index: -2 }, { kind: "paragraph", emphasis: "normal", text: "" });
	if (!content.editable) return overview(event);
	if (action.startsWith("description-add-")) {
		if (content.blocks.length >= MAX_DESCRIPTION_BLOCKS) return overview(event, "All 12 sections are in use. Edit or remove a section before adding another.");
		return editor(event, { ...target, index: -1 }, { kind: action.endsWith("heading") ? "heading" : action.endsWith("list") ? "bullet" : "paragraph", emphasis: "normal", text: "" });
	}
	const block = content.blocks[target.index];
	if (!block) return overview(event, "This section no longer exists. Choose another section to edit.");
	if (action === "description-edit") return editor(event, target, draftForBlock(block));
	const blocks = [...content.blocks];
	if (action === "description-remove") blocks.splice(target.index, 1);
	else {
		const next = target.index + (action === "description-up" ? -1 : 1);
		if (next < 0 || next >= blocks.length) return overview(event);
		[blocks[target.index], blocks[next]] = [blocks[next]!, blocks[target.index]!];
	}
	return saveBlocks(ctx, event, blocks);
}
