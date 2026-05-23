import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCapabilityMatrix } from "../core/capability-matrix.js";
import { buildCardTypeDecision, buildWorldbuildingTypeDecision, classifyWorldbookTaskWithClarification, detectClarificationNeeds } from "../core/clarification.js";
import { explainConfig, type ConfigTopic } from "../core/config-explainer.js";
import { getEntryTemplate } from "../core/entry-templates.js";
import { getToolUsageGuide } from "../core/tool-usage-guide.js";
import { classifyWorldbuildingType } from "../core/worldbuilding.js";
import { classifyWorldbookCardType } from "../core/worldbook-planning.js";
import { EntryTypeSchema } from "../schemas/worldbook-draft.js";
import { toolText } from "./helpers.js";

const TASK_CLASS_ENUM = z.enum(["original_character_card", "derivative_extraction", "worldbuilding_only", "item_ability_equipment", "style_extraction", "chapter_extraction", "modify_existing", "query_existing", "mvu_zod", "ejs_dynamic", "html_beautify", "content_lint"]);

export function registerWorkflowTools(server: McpServer): void {
  server.tool("classify_worldbook_task", {
    request: z.string().min(1),
    wants_character_card: z.boolean().optional(),
    wants_mvu: z.boolean().optional(),
    wants_html: z.boolean().optional(),
    wants_ejs: z.boolean().optional(),
    prefer_user_decision: z.boolean().optional(),
  }, async (input) => {
    const result = classifyWorldbookTaskWithClarification(input);
    if (input.prefer_user_decision) {
      const merged = { ...result, needs_user_decision: true, suggested_decisions: result.suggested_decisions.length > 0 ? result.suggested_decisions : detectClarificationNeeds({ ...input, task_type: result.task_type, stage: "intake" }).suggested_decisions };
      return toolText(merged);
    }
    return toolText({ ...result, needs_user_decision: result.needs_clarification });
  });

  server.tool("propose_clarification_questions", {
    request: z.string().optional(),
    task_type: TASK_CLASS_ENUM.optional(),
    wants_character_card: z.boolean().optional(),
    wants_mvu: z.boolean().optional(),
    wants_html: z.boolean().optional(),
    wants_ejs: z.boolean().optional(),
    stage: z.enum(["intake", "post_classification"]).optional(),
  }, async (input) => toolText(detectClarificationNeeds(input)));

  server.tool("get_worldbook_capability_matrix", { task_type: TASK_CLASS_ENUM.optional() }, async (input) => toolText(getCapabilityMatrix(input.task_type)));

  server.tool("get_tool_usage_guide", { tool: z.string().min(1) }, async (input) => toolText(getToolUsageGuide(input.tool)));

  server.tool("get_entry_template", { entry_type: EntryTypeSchema }, async (input) => toolText(getEntryTemplate(input.entry_type)));

  server.tool("explain_worldbook_config", { topic: z.enum(["position", "constant", "order", "recursion", "keys", "scan_depth", "all"]) }, async (input) => toolText(explainConfig(input.topic as ConfigTopic)));

  server.tool("classify_worldbook_card_type", { core_character_count: z.number().int().min(0), has_character_card: z.boolean().default(true), is_system_driven: z.boolean().optional(), prefer_user_decision: z.boolean().optional() }, async (input) => {
    if (input.prefer_user_decision) return toolText({ needs_user_decision: true, suggested_decisions: [buildCardTypeDecision()] });
    return toolText({ needs_user_decision: false, ...classifyWorldbookCardType(input) });
  });

  server.tool("classify_worldbuilding_type", { title: z.string().optional(), brief: z.string().optional(), tags: z.array(z.string()).optional(), prefer_user_decision: z.boolean().optional() }, async (input) => {
    if (input.prefer_user_decision) return toolText({ needs_user_decision: true, suggested_decisions: [buildWorldbuildingTypeDecision()] });
    return toolText({ needs_user_decision: false, ...classifyWorldbuildingType(input) });
  });
}
