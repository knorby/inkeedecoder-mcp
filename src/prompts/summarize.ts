import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

/**
 * Example prompt: a reusable template the user can invoke by name.
 *
 * Prompts are user-driven (slash commands, palette entries) rather than
 * model-driven. Keep arguments `.describe()`d — hosts render them as form
 * fields.
 *
 * TODO(template): replace or delete alongside the example tools.
 */

/** Registers the `example_summarize` prompt. */
export function registerSummarizePrompt(server: McpServer): void {
  server.registerPrompt(
    "example_summarize",
    {
      title: "Summarize a topic",
      description: "Ask the model for a short, structured summary of a topic.",
      argsSchema: z.object({
        topic: z.string().min(1).describe("The topic to summarize."),
        audience: z
          .string()
          .default("a technical reader")
          .describe("Who the summary is written for."),
      }),
    },
    ({ topic, audience }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Summarize "${topic}" for ${audience}. Use at most five bullet points, lead with the most important point, and note anything uncertain.`,
          },
        },
      ],
    }),
  );
}
