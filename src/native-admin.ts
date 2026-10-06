import type { BlockResponse } from "@emdash-cms/blocks";
import type { EventualContext } from "./storage";
import { nativeSchema } from "./domain/native-source";
import { handlePublicEvents } from "./routes/public-events";
export async function handleAdmin(
  input: unknown,
  ctx: EventualContext,
): Promise<BlockResponse> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return invalid();
  const request = input as Record<string, unknown>;
  if (
    !["page_load", "block_action", "form_submit"].includes(
      String(request.type),
    ) ||
    (request.type === "page_load" && typeof request.page !== "string") ||
    (request.type !== "page_load" && typeof request.action_id !== "string") ||
    (request.type === "form_submit" &&
      (!request.values ||
        typeof request.values !== "object" ||
        Array.isArray(request.values)))
  )
    return invalid();
  const schema = await nativeSchema(ctx);
  if (request.page === "widget:upcoming-events") {
    const feed = await handlePublicEvents({}, ctx);
    if (!feed.ok || !feed.events)
      return {
        blocks: [
          {
            type: "banner",
            title: "Upcoming events unavailable",
            variant: "error",
          },
        ],
      };
    return {
      blocks: feed.events.length
        ? [
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
          ]
        : [{ type: "empty", title: "No upcoming events" }],
    };
  }
  if (!schema)
    return {
      blocks: [
        {
          type: "banner",
          title: "Legacy event data is retained",
          description:
            "Apply the native collection blueprints, preview migrateToNative, then migrate in resumable batches. Legacy feeds and MCP tools remain available until the events collection is installed.",
        },
      ],
    };
  const target = schema.fields.find((field) => field.slug === "venue")?.options
    ?.collection;
  return {
    blocks: [
      { type: "header", text: "Eventual" },
      {
        type: "context",
        text: "Edit events and translations in EmDash collections. Publishing, revisions, scheduling, Portable Text and media use the native editor.",
      },
      {
        type: "actions",
        elements: [
          {
            type: "link",
            label: "Open events",
            target: {
              kind: "external",
              url: new URL("/_emdash/admin/content/events", ctx.site.url).href,
            },
          },
          ...(typeof target === "string"
            ? [
                {
                  type: "link" as const,
                  label: "Open venues",
                  target: {
                    kind: "external" as const,
                    url: new URL(
                      "/_emdash/admin/content/" + encodeURIComponent(target),
                      ctx.site.url,
                    ).href,
                  },
                },
              ]
            : []),
        ],
      },
    ],
  };
}
function invalid(): BlockResponse {
  return {
    blocks: [
      { type: "banner", title: "Invalid admin request", variant: "error" },
    ],
  };
}
