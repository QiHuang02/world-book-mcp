import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProjectWithSlug, updateProject } from "../storage/project-store.js";
import { clearUserDecision, listUserDecisions, recordUserDecision, requestUserDecision } from "../core/decision-prompts.js";
import { appendAcceptanceCriterion, appendCheckpoint, appendDecision, appendPlanNote, appendRisk, appendVerificationStep, planPath, readPlan, replacePlanSection, updatePlanItemStatusNote, upsertPlanItemNote, writePlan } from "../storage/plan-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { summarizePlanItems, type PlanItem } from "../schemas/plan.js";
import { toolText } from "./helpers.js";
import { UpdatePlanInputSchema } from "./plan-tool-schemas.js";

export function registerPlanTools(server: McpServer): void {
  server.tool("update_plan", UpdatePlanInputSchema.shape, async (input) => toolText(await logToolCall("update_plan", input, async () => {
    const parsed = UpdatePlanInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    const expectedRevision = resolveExpectedProjectRevision(parsed);
    if (expectedRevision !== undefined && project.revision !== expectedRevision) throw new Error(`project revision conflict: expected ${expectedRevision}, current ${project.revision}`);
    let planFilePath: string;
    switch (parsed.mode) {
      case "rewrite":
        if (parsed.content === undefined) throw new Error("rewrite 需要 content");
        planFilePath = await writePlan(slug, parsed.content);
        break;
      case "replace_section":
        if (!parsed.section || parsed.content === undefined) throw new Error("replace_section 需要 section 和 content");
        planFilePath = await replacePlanSection(slug, parsed.section, parsed.content);
        break;
      case "append_note":
        if (!parsed.section || parsed.content === undefined) throw new Error("append_note 需要 section 和 content");
        planFilePath = await appendPlanNote(slug, parsed.section, parsed.content);
        break;
      case "append_decision":
        if (!parsed.decision) throw new Error("append_decision 需要 decision");
        planFilePath = await appendDecision(slug, parsed.decision);
        break;
      case "set_export_target":
        if (!parsed.export_target) throw new Error("set_export_target 需要 export_target");
        planFilePath = await replacePlanSection(slug, "13. 导出计划", [`- 导出类型：${parsed.export_target.type}`, `- 文件名：${parsed.export_target.filename ?? "未指定"}`, `- strict review：${parsed.export_target.strict_review ?? false}`].join("\n"));
        await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, export_filename: parsed.export_target!.filename, strict_review: parsed.export_target!.strict_review } }), { expectedRevision });
        break;
      case "request_decision": {
        if (!parsed.decision_request) throw new Error("request_decision 需要 decision_request");
        let result: ReturnType<typeof requestUserDecision> | undefined;
        const saved = await updateProject(parsed.project_id, (latest) => { result = requestUserDecision(latest, parsed.decision_request!); return result.project; }, { expectedRevision });
        if (!result) throw new Error("request_decision 未生成结果");
        planFilePath = await appendPlanNote(slug, "5. 用户决策记录", `[待决] ${result.decision.question} (id=${result.decision.id})`);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, decision: result.decision, prompt_text: result.prompt_text, recorded_already: result.recorded_already, version: versionSnapshot({ project: saved }) };
      }
      case "record_decision": {
        if (!parsed.decision_record) throw new Error("record_decision 需要 decision_record");
        let result2: ReturnType<typeof recordUserDecision> | undefined;
        const saved = await updateProject(parsed.project_id, (latest) => { result2 = recordUserDecision(latest, parsed.decision_record!); return result2.project; }, { expectedRevision });
        if (!result2) throw new Error("record_decision 未生成结果");
        planFilePath = parsed.decision_record.append_to_plan !== false ? await appendDecision(slug, { question: result2.recorded.question, answer: parsed.decision_record.custom_text ?? parsed.decision_record.selected_values?.join(", ") ?? "", rationale: "" }) : (await readPlan(slug), planPath(slug));
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, recorded: result2.recorded, version: versionSnapshot({ project: saved }) };
      }
      case "list_decisions":
        return { ok: true, project_id: parsed.project_id, ...listUserDecisions(project, parsed.decision_filter) };
      case "clear_decision": {
        if (!parsed.decision_id) throw new Error("clear_decision 需要 decision_id");
        let cleared: ReturnType<typeof clearUserDecision> | undefined;
        const saved = await updateProject(parsed.project_id, (latest) => { cleared = clearUserDecision(latest, parsed.decision_id!); return cleared.project; }, { expectedRevision });
        if (!cleared) throw new Error("clear_decision 未生成结果");
        planFilePath = await appendPlanNote(slug, "5. 用户决策记录", `[已清除] id=${parsed.decision_id}`);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, cleared_pending: cleared.cleared_pending, cleared_recorded: cleared.cleared_recorded, version: versionSnapshot({ project: saved }) };
      }
      case "upsert_plan_item": {
        if (!parsed.plan_item) throw new Error("upsert_plan_item 需要 plan_item");
        const item = parsed.plan_item;
        const saved = await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, plan_items: upsertPlanItem(latest.plan.plan_items ?? [], item) } }), { expectedRevision });
        planFilePath = await upsertPlanItemNote(slug, item);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(saved.plan.plan_items ?? []), version: versionSnapshot({ project: saved }) };
      }
      case "update_plan_item_status": {
        if (!parsed.plan_item_status) throw new Error("update_plan_item_status 需要 plan_item_status");
        const saved = await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, plan_items: (latest.plan.plan_items ?? []).map((item) => item.id === parsed.plan_item_status!.id ? { ...item, status: parsed.plan_item_status!.status } : item) } }), { expectedRevision });
        planFilePath = await updatePlanItemStatusNote(slug, parsed.plan_item_status.id, parsed.plan_item_status.status);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(saved.plan.plan_items ?? []), version: versionSnapshot({ project: saved }) };
      }
      case "append_acceptance": {
        if (!parsed.acceptance_criterion) throw new Error("append_acceptance 需要 acceptance_criterion");
        const saved = await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, acceptance_criteria: uniqueAppend(latest.plan.acceptance_criteria ?? [], parsed.acceptance_criterion!) } }), { expectedRevision });
        planFilePath = await appendAcceptanceCriterion(slug, parsed.acceptance_criterion);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(saved.plan.plan_items ?? []), version: versionSnapshot({ project: saved }) };
      }
      case "append_verification": {
        if (!parsed.verification_step) throw new Error("append_verification 需要 verification_step");
        const saved = await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, verification_steps: uniqueAppend(latest.plan.verification_steps ?? [], parsed.verification_step!) } }), { expectedRevision });
        planFilePath = await appendVerificationStep(slug, parsed.verification_step);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(saved.plan.plan_items ?? []), version: versionSnapshot({ project: saved }) };
      }
      case "append_risk": {
        if (!parsed.risk_note) throw new Error("append_risk 需要 risk_note");
        const saved = await updateProject(parsed.project_id, (latest) => ({ ...latest, plan: { ...latest.plan, risk_register: uniqueAppend(latest.plan.risk_register ?? [], parsed.risk_note!) } }), { expectedRevision });
        planFilePath = await appendRisk(slug, parsed.risk_note);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(saved.plan.plan_items ?? []), version: versionSnapshot({ project: saved }) };
      }
      case "append_checkpoint": {
        if (!parsed.checkpoint_note) throw new Error("append_checkpoint 需要 checkpoint_note");
        planFilePath = await appendCheckpoint(slug, parsed.checkpoint_note);
        return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_summary: summarizePlanItems(project.plan.plan_items ?? []) };
      }
      case "summarize_plan":
        return { ok: true, project_id: parsed.project_id, plan_summary: summarizePlanItems(project.plan.plan_items ?? []), acceptance_criteria_count: project.plan.acceptance_criteria?.length ?? 0, verification_steps_count: project.plan.verification_steps?.length ?? 0, risk_count: project.plan.risk_register?.length ?? 0 };
      default: throw new Error(`未知 update_plan mode: ${parsed.mode}`);
    }
    return { ok: true, project_id: parsed.project_id, plan_path: planFilePath, plan_preview: (await readPlan(slug)).slice(0, 1200) };
  })));
}

function upsertPlanItem(items: PlanItem[], item: PlanItem): PlanItem[] {
  const next = items.filter((existing) => existing.id !== item.id);
  next.push(item);
  return next;
}

function uniqueAppend(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}
