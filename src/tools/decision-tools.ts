import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { clearUserDecision, listUserDecisions, recordUserDecision, requestUserDecision } from "../core/decision-prompts.js";
import { DecisionOptionSchema } from "../schemas/decision.js";
import { loadProject, saveProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerDecisionTools(server: McpServer): void {
  server.tool("request_user_decision", {
    project_id: z.string(),
    id: z.string().min(1),
    question: z.string().min(1),
    context: z.string().optional(),
    source_tool: z.string().optional(),
    options: z.array(DecisionOptionSchema).optional(),
    allow_custom: z.boolean().optional(),
    multiple: z.boolean().optional(),
    default_value: z.string().optional(),
  }, async (input) => {
    const project = await loadProject(input.project_id);
    const result = requestUserDecision(project, input);
    await saveProject(result.project);
    return toolText({
      project_id: result.project.id,
      decision: result.decision,
      prompt_text: result.prompt_text,
      recorded_already: result.recorded_already,
      recommended_next_tool: "record_user_decision",
    });
  });

  server.tool("record_user_decision", {
    project_id: z.string(),
    id: z.string().min(1),
    selected_values: z.array(z.string()).default([]),
    custom_text: z.string().optional(),
  }, async (input) => {
    const project = await loadProject(input.project_id);
    const result = recordUserDecision(project, input);
    await saveProject(result.project);
    return toolText({ project_id: result.project.id, recorded: result.recorded, recommended_next_tool: result.recommended_next_tool });
  });

  server.tool("list_user_decisions", {
    project_id: z.string(),
    only_pending: z.boolean().optional(),
    only_recorded: z.boolean().optional(),
  }, async (input) => {
    const project = await loadProject(input.project_id);
    return toolText(listUserDecisions(project, { only_pending: input.only_pending, only_recorded: input.only_recorded }));
  });

  server.tool("clear_user_decision", { project_id: z.string(), id: z.string().min(1) }, async (input) => {
    const project = await loadProject(input.project_id);
    const result = clearUserDecision(project, input.id);
    await saveProject(result.project);
    return toolText({ project_id: result.project.id, cleared_pending: result.cleared_pending, cleared_recorded: result.cleared_recorded });
  });
}
