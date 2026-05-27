import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProjectWithSlug, updateProject } from "../storage/project-store.js";
import { clearUserDecision, listUserDecisions, recordUserDecision, requestUserDecision } from "../core/decision-prompts.js";
import { appendDecision, appendPlanNote, planPath, readPlan, replacePlanSection, writePlan } from "../storage/plan-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";
import { UpdatePlanInputSchema } from "./plan-tool-schemas.js";

export function registerPlanTools(server: McpServer): void {
  server.tool("update_plan", UpdatePlanInputSchema.shape, async (input) => toolText(await logToolCall("update_plan", input, async () => {
    const { project, slug } = await loadProjectWithSlug(input.project_id);
    const expectedRevision = resolveExpectedProjectRevision(input);
    if (expectedRevision !== undefined && project.revision !== expectedRevision) throw new Error(`project revision conflict: expected ${expectedRevision}, current ${project.revision}`);
    let planFilePath: string;
    switch (input.mode) {
      case "rewrite":
        if (input.content === undefined) throw new Error("rewrite 需要 content");
        planFilePath = await writePlan(slug, input.content);
        break;
      case "replace_section":
        if (!input.section || input.content === undefined) throw new Error("replace_section 需要 section 和 content");
        planFilePath = await replacePlanSection(slug, input.section, input.content);
        break;
      case "append_note":
        if (!input.section || input.content === undefined) throw new Error("append_note 需要 section 和 content");
        planFilePath = await appendPlanNote(slug, input.section, input.content);
        break;
      case "append_decision":
        if (!input.decision) throw new Error("append_decision 需要 decision");
        planFilePath = await appendDecision(slug, input.decision);
        break;
      case "set_export_target":
        if (!input.export_target) throw new Error("set_export_target 需要 export_target");
        planFilePath = await replacePlanSection(slug, "10. 导出计划", [`- 导出类型：${input.export_target.type}`, `- 文件名：${input.export_target.filename ?? "未指定"}`, `- strict review：${input.export_target.strict_review ?? false}`].join("\n"));
        await updateProject(input.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, export_filename: input.export_target!.filename, strict_review: input.export_target!.strict_review } }), { expectedRevision });
        break;
      case "request_decision": {
        if (!input.decision_request) throw new Error("request_decision 需要 decision_request");
        let result: ReturnType<typeof requestUserDecision> | undefined;
        const saved = await updateProject(input.project_id, (latest) => { result = requestUserDecision(latest, input.decision_request!); return result.project; }, { expectedRevision });
        if (!result) throw new Error("request_decision 未生成结果");
        planFilePath = await appendPlanNote(slug, "5. 用户决策记录", `[待决] ${result.decision.question} (id=${result.decision.id})`);
        return { ok: true, project_id: input.project_id, plan_path: planFilePath, decision: result.decision, prompt_text: result.prompt_text, recorded_already: result.recorded_already, version: versionSnapshot({ project: saved }) };
      }
      case "record_decision": {
        if (!input.decision_record) throw new Error("record_decision 需要 decision_record");
        let result2: ReturnType<typeof recordUserDecision> | undefined;
        const saved = await updateProject(input.project_id, (latest) => { result2 = recordUserDecision(latest, input.decision_record!); return result2.project; }, { expectedRevision });
        if (!result2) throw new Error("record_decision 未生成结果");
        planFilePath = input.decision_record.append_to_plan !== false ? await appendDecision(slug, { question: result2.recorded.question, answer: input.decision_record.custom_text ?? input.decision_record.selected_values?.join(", ") ?? "", rationale: "" }) : (await readPlan(slug), planPath(slug));
        return { ok: true, project_id: input.project_id, plan_path: planFilePath, recorded: result2.recorded, version: versionSnapshot({ project: saved }) };
      }
      case "list_decisions":
        return { ok: true, project_id: input.project_id, ...listUserDecisions(project, input.decision_filter) };
      case "clear_decision": {
        if (!input.decision_id) throw new Error("clear_decision 需要 decision_id");
        let cleared: ReturnType<typeof clearUserDecision> | undefined;
        const saved = await updateProject(input.project_id, (latest) => { cleared = clearUserDecision(latest, input.decision_id!); return cleared.project; }, { expectedRevision });
        if (!cleared) throw new Error("clear_decision 未生成结果");
        planFilePath = await appendPlanNote(slug, "5. 用户决策记录", `[已清除] id=${input.decision_id}`);
        return { ok: true, project_id: input.project_id, plan_path: planFilePath, cleared_pending: cleared.cleared_pending, cleared_recorded: cleared.cleared_recorded, version: versionSnapshot({ project: saved }) };
      }
      default: throw new Error(`未知 update_plan mode: ${input.mode}`);
    }
    return { ok: true, project_id: input.project_id, plan_path: planFilePath, plan_preview: (await readPlan(slug)).slice(0, 1200) };
  })));
}
