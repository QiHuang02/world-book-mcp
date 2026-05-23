import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { appendDecision, appendPlanNote, readPlan, replacePlanSection, writePlan } from "../storage/plan-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

export function registerPlanTools(server: McpServer): void {
  server.tool("update_plan", {
    project_id: z.string(),
    mode: z.enum(["replace_section", "append_decision", "append_note", "set_export_target", "rewrite"]),
    section: z.string().optional(),
    content: z.string().optional(),
    decision: z.object({ question: z.string(), answer: z.string(), rationale: z.string().optional() }).optional(),
    export_target: z.object({
      type: z.enum(["worldbook", "character_card", "both"]),
      filename: z.string().optional(),
      strict_review: z.boolean().optional(),
    }).optional(),
    expected_revision: z.number().int().nonnegative().optional(),
  }, async (input) => toolText(await logToolCall("update_plan", input, async () => {
    await loadProject(input.project_id);
    let path: string;
    switch (input.mode) {
      case "rewrite":
        if (input.content === undefined) throw new Error("rewrite 需要 content");
        path = await writePlan(input.content);
        break;
      case "replace_section":
        if (!input.section || input.content === undefined) throw new Error("replace_section 需要 section 和 content");
        path = await replacePlanSection(input.section, input.content);
        break;
      case "append_note":
        if (!input.section || input.content === undefined) throw new Error("append_note 需要 section 和 content");
        path = await appendPlanNote(input.section, input.content);
        break;
      case "append_decision":
        if (!input.decision) throw new Error("append_decision 需要 decision");
        path = await appendDecision(input.decision);
        break;
      case "set_export_target":
        if (!input.export_target) throw new Error("set_export_target 需要 export_target");
        path = await replacePlanSection("15. 导出计划", [
          `- 导出类型：${input.export_target.type}`,
          `- 文件名：${input.export_target.filename ?? "未指定"}`,
          `- strict review：${input.export_target.strict_review ?? false}`,
        ].join("\n"));
        await updateProject(input.project_id, (project) => ({
          ...project,
          plan: {
            ...project.plan,
            output_target: input.export_target!.type,
            export_filename: input.export_target!.filename,
            strict_review: input.export_target!.strict_review,
          },
        }), { expectedRevision: input.expected_revision });
        break;
      default: {
        const exhaustive: never = input.mode;
        throw new Error(`未知 update_plan mode: ${exhaustive}`);
      }
    }
    return { ok: true, project_id: input.project_id, plan_path: path, plan_preview: (await readPlan()).slice(0, 1200) };
  })));
}
