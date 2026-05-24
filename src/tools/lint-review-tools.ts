import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lintContent } from "../core/content-lint.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { createFinalReviewReport } from "../core/final-review.js";
import { lintProjectContent } from "../core/project-lint.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { createWritingOptimizationReport } from "../core/writing-optimization-report.js";
import { loadProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerLintReviewTools(server: McpServer): void {
  server.tool("lint_worldbook_content", { content: z.string().min(1) }, async (input) => toolText(lintContent(input.content)));

  server.tool("lint_project_content", { project_id: z.string() }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(lintProjectContent(project));
  });

  server.tool("create_writing_optimization_report", { content: z.string().optional(), project_id: z.string().optional() }, async (input) => {
    const project = input.project_id ? (await hydrateProjectDraft(await loadProject(input.project_id))).project : undefined;
    if (!input.content && !project) throw new Error("需要提供 content 或 project_id");
    return toolText(createWritingOptimizationReport({ content: input.content, project }));
  });

  server.tool("review_project", { project_id: z.string() }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(createFinalReviewReport(project));
  });

  server.tool("check_delivery", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card"]) }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(createDeliveryChecklist({ project, export_target: input.export_target }));
  });

  server.tool("create_final_review_report", { project_id: z.string() }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(createFinalReviewReport(project));
  });

  server.tool("create_delivery_checklist", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card"]) }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(createDeliveryChecklist({ project, export_target: input.export_target }));
  });
}
