import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createWorldbuildingDesignTemplate, createWorldbuildingOutline, validateWorldbuildingDesign, validateWorldbuildingSummary } from "../core/worldbuilding.js";
import { WorldbuildingSummarySchema } from "../schemas/project.js";
import { loadProject, saveProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerWorldbuildingTools(server: McpServer): void {
  server.tool("create_worldbuilding_outline", {
    project_id: z.string().optional(),
    title: z.string().optional(),
    world_type: z.enum(["A_realistic_background", "B_small_world", "C_large_world"]).optional(),
  }, async (input) => toolText({ project_id: input.project_id, ...createWorldbuildingOutline(input), recommended_next_tool: "submit_worldbuilding_summary" }));

  server.tool("submit_worldbuilding_summary", { project_id: z.string(), summary: WorldbuildingSummarySchema }, async (input) => {
    const project = await loadProject(input.project_id);
    const summary = WorldbuildingSummarySchema.parse(input.summary);
    await saveProject({ ...project, worldbuildingSummary: summary });
    const validation = validateWorldbuildingSummary(summary);
    return toolText({ project_id: input.project_id, validation, recommended_next_tool: validation.ok ? "submit_extraction_result" : "validate_worldbuilding_summary" });
  });

  server.tool("validate_worldbuilding_summary", { project_id: z.string().optional(), summary: WorldbuildingSummarySchema.optional() }, async (input) => {
    const summary = input.summary ?? (input.project_id ? (await loadProject(input.project_id)).worldbuildingSummary : undefined);
    if (!summary) throw new Error("需要传入 summary 或提供已有 worldbuildingSummary 的 project_id");
    return toolText(validateWorldbuildingSummary(summary));
  });

  server.tool("create_worldbuilding_design_template", { world_type: z.enum(["A_realistic_background", "B_small_world", "C_large_world"]).optional(), title: z.string().optional() }, async (input) => toolText(createWorldbuildingDesignTemplate(input)));

  server.tool("validate_worldbuilding_design", {
    design: z.object({
      world_type: z.enum(["A_realistic_background", "B_small_world", "C_large_world"]),
      title: z.string().min(1),
      geography: z.string().optional(),
      history: z.string().optional(),
      factions: z.string().optional(),
      rules: z.string().optional(),
      society: z.string().optional(),
      technology: z.string().optional(),
      boundaries: z.string().optional(),
    }),
  }, async (input) => toolText(validateWorldbuildingDesign(input.design)));
}
