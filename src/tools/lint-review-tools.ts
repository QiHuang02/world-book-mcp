import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { createFinalReviewReport } from "../core/final-review.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { loadProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

export function registerLintReviewTools(server: McpServer): void {
  server.tool("review_project", { project_id: z.string() }, async (input) => toolText(await logToolCall("review_project", input, async () => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return createFinalReviewReport(project);
  })));

  server.tool("check_delivery", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card"]), strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional() }, async (input) => toolText(await logToolCall("check_delivery", input, async () => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return createDeliveryChecklist({ project, export_target: input.export_target, strict_review: input.strict_review });
  })));

  server.tool("create_final_review_report", { project_id: z.string() }, async (input) => toolText(await logToolCall("create_final_review_report", input, async () => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return createFinalReviewReport(project);
  })));

  server.tool("create_delivery_checklist", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card"]), strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional() }, async (input) => toolText(await logToolCall("create_delivery_checklist", input, async () => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return createDeliveryChecklist({ project, export_target: input.export_target, strict_review: input.strict_review });
  })));
}
