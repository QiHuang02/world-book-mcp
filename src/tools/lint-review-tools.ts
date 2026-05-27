import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { createFinalReviewReport } from "../core/final-review.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { validateProject } from "../core/project-validator.js";
import { loadFreshBuild } from "../core/build-pipeline.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

export function registerLintReviewTools(server: McpServer): void {
  server.tool("review_project", { project_id: z.string() }, async (input) => toolText(await logToolCall("review_project", input, async () => {
    const { project, slug } = await loadProjectWithSlug(input.project_id);
    const hydrated = await hydrateProjectDraft(project, slug);
    return createFinalReviewReport(hydrated.project);
  })));

  server.tool("check_delivery", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card", "both"]).optional(), build_id: z.string().optional() }, async (input) => toolText(await logToolCall("check_delivery", input, async () => {
    const { project, slug } = await loadProjectWithSlug(input.project_id);
    const hydrated = await hydrateProjectDraft(project, slug);
    const build = await loadFreshBuild({ slug, build_id: input.build_id });
    const report = validateProject(hydrated.project, { scope: "delivery", build });
    return createDeliveryChecklist({ project, review: report, export_target: input.export_target ?? project.kind.output });
  })));

  server.tool("create_final_review_report", { project_id: z.string() }, async (input) => toolText(await logToolCall("create_final_review_report", input, async () => {
    const { project, slug } = await loadProjectWithSlug(input.project_id);
    const hydrated = await hydrateProjectDraft(project, slug);
    return createFinalReviewReport(hydrated.project);
  })));

  server.tool("create_delivery_checklist", { project_id: z.string(), export_target: z.enum(["worldbook", "character_card", "both"]).optional(), build_id: z.string().optional() }, async (input) => toolText(await logToolCall("create_delivery_checklist", input, async () => {
    const { project, slug } = await loadProjectWithSlug(input.project_id);
    const hydrated = await hydrateProjectDraft(project, slug);
    const build = await loadFreshBuild({ slug, build_id: input.build_id });
    const report = validateProject(hydrated.project, { scope: "delivery", build });
    return createDeliveryChecklist({ project, review: report, export_target: input.export_target ?? project.kind.output });
  })));
}
