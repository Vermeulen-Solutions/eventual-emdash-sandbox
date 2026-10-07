import type { BlockResponse } from "@emdash-cms/blocks";
import type { SandboxedRouteContext } from "emdash/plugin";
import type { CollectionSchemaInfo } from "emdash";
import type { EventualContext } from "./storage";
import { listEvents } from "./storage";
import { nativeSchema } from "./domain/native-source";
import { referenceTarget } from "./domain/native-references";
import { handlePublicEvents } from "./routes/public-events";
import {
  prepareNativeDuplicate,
  formatHumanRecurrence,
} from "./native/event-commands";
import { instantToLocalDateTime } from "./domain/date-time";

const failure = (message: string): BlockResponse => ({
  blocks: [
    {
      type: "banner",
      title: "Unable to continue",
      description: message,
      variant: "error",
    },
  ],
});
function link(ctx: EventualContext, path: string, label: string) {
  return {
    type: "link" as const,
    label,
    target: {
      kind: "external" as const,
      url: new URL(path, ctx.site.url).href,
    },
  };
}

/** Read-only workspace apart from creating an unpublished copy. No collection settings writes. */
export async function handleAdmin(
  input: unknown,
  ctx: EventualContext,
  user?: SandboxedRouteContext["user"],
): Promise<BlockResponse> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return failure("Invalid request.");
  const request = input as Record<string, unknown>;
  if (
    !["page_load", "button_click", "block_action", "form_submit"].includes(
      String(request.type),
    ) ||
    (request.type === "page_load" && typeof request.page !== "string") ||
    (request.type !== "page_load" && typeof request.action_id !== "string") ||
    (request.type === "form_submit" &&
      (!request.values ||
        typeof request.values !== "object" ||
        Array.isArray(request.values)))
  )
    return {
      blocks: [
        { type: "banner", title: "Invalid admin request", variant: "error" },
      ],
    };
  try {
    if (request.page === "widget:upcoming-events") {
      const feed = await handlePublicEvents({}, ctx);
      if (!feed.ok || !feed.events)
        return failure("Upcoming events could not be loaded.");
      return {
        blocks: [
          { type: "header", text: "Upcoming events" },
          ...feed.events
            .slice(0, 5)
            .map((event) => ({
              type: "section" as const,
              text: event.title + " · " + event.start,
            })),
          {
            type: "actions",
            elements: [
              {
                type: "link",
                label: "Manage events",
                target: { kind: "plugin-page", path: "/events" },
              },
            ],
          },
        ],
      };
    }
    const schema = await nativeSchema(ctx);
    if (!schema) {
      const events = await listEvents(ctx);
      return {
        blocks: [
          { type: "header", text: "Eventual" },
          {
            type: "banner",
            title: "Legacy event data is retained",
            description:
              "An administrator must install the native schemas and preview the migration. Existing feeds remain available.",
          },
          ...events
            .slice(0, 10)
            .map((event) => ({
              type: "section" as const,
              text: event.title + " · " + event.start,
            })),
        ],
      };
    }
    return await workspace(request, ctx, schema, user);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Events could not be loaded.",
    );
  }
}

async function workspace(
  request: Record<string, unknown>,
  ctx: EventualContext,
  schema: CollectionSchemaInfo,
  user?: SandboxedRouteContext["user"],
): Promise<BlockResponse> {
  const blocks: BlockResponse["blocks"] = [
    { type: "header", text: "Events" },
    {
      type: "context",
      text: "Write the announcement in EmDash. Open “Dates, venue & repeat” to set dates and manage individual occurrences. Save a new event first to open its schedule panel.",
    },
  ];
  if (request.action_id === "duplicate-event") {
    // The admin route requires content:edit_any, which implies content:create in core's RBAC.
    // Tokens without an attested user cannot delegate a write through this workspace.
    if (!user || !ctx.content?.create || typeof request.value !== "string")
      return failure("Open Eventual while signed in to create a copy.");
    const source = await ctx.content.get("events", request.value);
    if (!source) return failure("This event no longer exists.");
    const data = prepareNativeDuplicate(source.data);
    const allowed = new Set(
      schema.fields
        .filter((field) => !field.validation?.relation)
        .map((field) => field.slug),
    );
    const payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => allowed.has(key)),
    );
    payload.title = String(payload.title || "Event") + " (copy)";
    const created = await ctx.content.create("events", payload, {
      locale: source.locale ?? undefined,
    });
    blocks.push(
      {
        type: "banner",
        title: "Draft copy created",
        description:
          "The copy has its own calendar identity and starts unpublished.",
      },
      {
        type: "actions",
        elements: [
          link(
            ctx,
            "/_emdash/admin/content/events/" + encodeURIComponent(created.id),
            "Edit the copy",
          ),
        ],
      },
    );
  } else if (request.action_id && request.action_id !== "page-native-events")
    return failure("This action is unavailable. Reload the workspace.");
  const venue = referenceTarget(schema, "venue"),
    organizer = referenceTarget(schema, "organizer_ref");
  const collections = await ctx.schema!.listCollections();
  blocks.push({
    type: "actions",
    elements: [
      link(ctx, "/_emdash/admin/content/events/new", "Create event"),
      link(ctx, "/_emdash/admin/content/events", "All events"),
      ...[venue, organizer]
        .filter((slug) => collections.some((item) => item.slug === slug))
        .map((slug) =>
          link(
            ctx,
            "/_emdash/admin/content/" + encodeURIComponent(slug),
            slug === venue ? "Manage venues" : "Manage organizers",
          ),
        ),
    ],
  });
  const cursor =
    request.action_id === "page-native-events" &&
    typeof request.value === "string"
      ? request.value || undefined
      : undefined;
  const page = await ctx.content!.list("events", { limit: 25, cursor });
  blocks.push({
    type: "table",
    page_action_id: "page-native-events",
    columns: [
      { key: "title", label: "Event" },
      { key: "locale", label: "Language" },
      { key: "schedule", label: "Date & repeat" },
      { key: "status", label: "Publication", format: "badge" },
      { key: "edit", label: "Edit", format: "element" },
      ...(user
        ? [{ key: "duplicate", label: "Copy", format: "element" as const }]
        : []),
    ],
    rows: page.items.map((item) => {
      const data = item.data;
      let start = String(
        data.all_day ? (data.start_date ?? "") : (data.start ?? ""),
      );
      try {
        if (start && !data.all_day)
          start = instantToLocalDateTime(start, String(data.timezone || "UTC"));
      } catch {
        start = "Check dates in editor";
      }
      return {
        title: String(data.title || item.slug || "Untitled event"),
        locale: item.locale || "—",
        schedule:
          start +
          (data.recurrence
            ? " · " + formatHumanRecurrence(data.recurrence)
            : ""),
        status: item.status,
        edit: link(
          ctx,
          "/_emdash/admin/content/events/" + encodeURIComponent(item.id),
          "Edit",
        ),
        ...(user
          ? {
              duplicate: {
                type: "button",
                action_id: "duplicate-event",
                label: "Duplicate",
                value: item.id,
              },
            }
          : {}),
      };
    }),
    empty_text: "No events. Create your first event to get started.",
  });
  const pages: Extract<
    BlockResponse["blocks"][number],
    { type: "actions" }
  >["elements"] = [];
  if (cursor)
    pages.push({
      type: "button",
      action_id: "page-native-events",
      label: "First page",
      value: "",
    });
  if (page.hasMore) {
    if (!page.cursor || page.cursor === cursor)
      throw new Error("The event list returned an incomplete page. Reload it.");
    pages.push({
      type: "button",
      action_id: "page-native-events",
      label: "Next events",
      value: page.cursor,
    });
  }
  if (pages.length) blocks.push({ type: "actions", elements: pages });
  blocks.push(
    { type: "divider" },
    { type: "header", text: "Subscribe" },
    {
      type: "actions",
      elements: [
        link(
          ctx,
          "/_emdash/api/plugins/eventual/calendar",
          "Calendar subscription (.ics)",
        ),
        link(
          ctx,
          "/_emdash/api/plugins/eventual/publicEvents",
          "Published events (JSON)",
        ),
      ],
    },
    {
      type: "context",
      text: "Calendar subscribers receive published events. Add ?locale=fr to choose a language; add &strict=true to include only translated events.",
    },
  );
  return { blocks };
}
