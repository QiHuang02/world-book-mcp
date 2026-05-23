import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { explainConfig, type ConfigTopic } from "../core/config-explainer.js";
import { getEntryTemplate } from "../core/entry-templates.js";
import { EntryTypeSchema } from "../schemas/worldbook-draft.js";
import { toolText } from "./helpers.js";

export function registerReferenceTools(server: McpServer): void {
  server.tool("get_entry_template", { entry_type: EntryTypeSchema }, async (input) => toolText(getEntryTemplate(input.entry_type)));

  server.tool("explain_worldbook_config", { topic: z.enum(["position", "constant", "order", "recursion", "keys", "scan_depth", "all"]) }, async (input) => toolText(explainConfig(input.topic as ConfigTopic)));
}
