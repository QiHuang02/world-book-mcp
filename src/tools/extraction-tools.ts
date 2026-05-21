import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDerivativeExtractionTemplate, derivativeOutlineToExtraction, validateDerivativeExtractionOutline } from "../core/derivative-outline.js";
import { createExtractionOutline, type ExtractionFocus } from "../core/extraction-outline.js";
import { planEntries } from "../core/entry-planner.js";
import { DerivativeExtractionOutlineSchema, DerivativeFocusSchema, DerivativeSourceKindSchema } from "../schemas/derivative-outline.js";
import { SubmitExtractionResultInputSchema } from "../schemas/extraction.js";
import { loadProject, saveProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerExtractionTools(server: McpServer): void {
  server.tool("create_extraction_outline", { project_id: z.string().optional(), focus: z.array(z.enum(["characters", "world", "items", "events"])).optional() }, async (input) => {
    const outline = createExtractionOutline(input.focus as ExtractionFocus[] | undefined) as Record<string, unknown>;
    return toolText({ project_id: input.project_id, ...outline });
  });

  server.tool("submit_extraction_result", SubmitExtractionResultInputSchema.shape, async (input) => {
    const parsed = SubmitExtractionResultInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const extraction = {
      projectId: parsed.project_id,
      title: parsed.title,
      characters: parsed.characters,
      world: parsed.world,
      items: parsed.items,
      events: parsed.events,
      sourceRefs: parsed.sourceRefs,
    };
    await saveProject({ ...project, extraction });
    return toolText({ project_id: parsed.project_id, character_count: extraction.characters.length, world_fact_count: extraction.world.length, item_count: extraction.items.length, event_count: extraction.events.length, recommended_next_tool: "plan_worldbook_entries" });
  });

  server.tool("plan_worldbook_entries", { project_id: z.string() }, async (input) => {
    const project = await loadProject(input.project_id);
    if (!project.extraction) throw new Error("项目尚未提交 extraction result");
    const result = planEntries(project.extraction);
    await saveProject({ ...project, plan: result.entries_plan });
    return toolText({ project_id: project.id, ...result, recommended_next_tool: "draft_worldbook_entries" });
  });

  server.tool("create_derivative_extraction_template", {
    project_id: z.string().optional(),
    title: z.string().optional(),
    source_kind: DerivativeSourceKindSchema.optional(),
    focus: z.array(DerivativeFocusSchema).optional(),
  }, async (input) => toolText({ project_id: input.project_id, outline: createDerivativeExtractionTemplate(input), recommended_next_tool: "submit_derivative_extraction_outline" }));

  server.tool("submit_derivative_extraction_outline", { project_id: z.string(), outline: DerivativeExtractionOutlineSchema, sync_extraction: z.boolean().default(true) }, async (input) => {
    const project = await loadProject(input.project_id);
    const validation = validateDerivativeExtractionOutline(input.outline);
    const extraction = input.sync_extraction ? derivativeOutlineToExtraction(input.project_id, input.outline) : project.extraction;
    await saveProject({ ...project, derivativeOutline: input.outline, extraction });
    return toolText({ project_id: input.project_id, validation, synced_extraction: input.sync_extraction, recommended_next_tool: validation.valid ? "create_worldbook_entry_plan" : "validate_derivative_extraction_outline" });
  });

  server.tool("validate_derivative_extraction_outline", { project_id: z.string().optional(), outline: DerivativeExtractionOutlineSchema.optional() }, async (input) => {
    const outline = input.outline ?? (input.project_id ? (await loadProject(input.project_id)).derivativeOutline : undefined);
    if (!outline) throw new Error("需要传入 outline 或提供已有 derivativeOutline 的 project_id");
    return toolText(validateDerivativeExtractionOutline(outline));
  });
}
