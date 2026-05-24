import type { Project } from "../schemas/project.js";
import type { DecisionOption, PendingDecision, RecordedDecision } from "../schemas/decision.js";
import { nowIso } from "../utils/ids.js";

export function requestUserDecision(project: Project, input: {
  id: string;
  question: string;
  context?: string;
  source_tool?: string;
  options?: DecisionOption[];
  allow_custom?: boolean;
  multiple?: boolean;
  default_value?: string;
}): { project: Project; decision: PendingDecision; prompt_text: string; recorded_already: RecordedDecision | undefined } {
  const decision: PendingDecision = {
    id: input.id,
    question: input.question,
    context: input.context,
    source_tool: input.source_tool,
    options: input.options ?? [],
    allow_custom: input.allow_custom ?? true,
    multiple: input.multiple ?? false,
    default_value: input.default_value,
    created_at: nowIso(),
  };
  const pending = [...(project.pendingDecisions ?? []).filter((item) => item.id !== input.id), decision];
  const updated: Project = { ...project, pendingDecisions: pending };
  const recorded_already = (project.recordedDecisions ?? []).find((item) => item.id === input.id);
  return { project: updated, decision, prompt_text: renderPrompt(decision), recorded_already };
}

export function recordUserDecision(project: Project, input: {
  id: string;
  selected_values?: string[];
  custom_text?: string;
}): { project: Project; recorded: RecordedDecision } {
  const pending = (project.pendingDecisions ?? []).find((item) => item.id === input.id);
  if (!pending && !(project.recordedDecisions ?? []).some((item) => item.id === input.id)) {
    throw new Error(`未找到 id=${input.id} 的 pending decision，请先调用 request_user_decision`);
  }
  const selected = input.selected_values ?? [];
  if (pending) {
    if (!pending.allow_custom && selected.length === 0) throw new Error(`决策 ${input.id} 不允许自由输入，必须从 options 中选择`);
    if (!pending.multiple && selected.length > 1) throw new Error(`决策 ${input.id} 为单选，selected_values 只允许 1 个`);
    if (pending.options.length > 0 && !pending.allow_custom) {
      const allowed = new Set(pending.options.map((option) => option.value));
      for (const value of selected) {
        if (!allowed.has(value)) throw new Error(`决策 ${input.id} 收到了非法选项：${value}`);
      }
    }
  }

  const question = pending?.question ?? (project.recordedDecisions ?? []).find((item) => item.id === input.id)?.question ?? "";
  const recorded: RecordedDecision = {
    id: input.id,
    question,
    selected_values: selected,
    custom_text: input.custom_text,
    source_tool: pending?.source_tool,
    recorded_at: nowIso(),
  };
  const newRecorded = [...(project.recordedDecisions ?? []).filter((item) => item.id !== input.id), recorded];
  const newPending = (project.pendingDecisions ?? []).filter((item) => item.id !== input.id);
  return { project: { ...project, pendingDecisions: newPending, recordedDecisions: newRecorded }, recorded };
}

export function listUserDecisions(project: Project, filter?: { only_pending?: boolean; only_recorded?: boolean }): { pending: PendingDecision[]; recorded: RecordedDecision[] } {
  return {
    pending: filter?.only_recorded ? [] : project.pendingDecisions ?? [],
    recorded: filter?.only_pending ? [] : project.recordedDecisions ?? [],
  };
}

export function clearUserDecision(project: Project, id: string): { project: Project; cleared_pending: boolean; cleared_recorded: boolean } {
  const pendingBefore = project.pendingDecisions ?? [];
  const recordedBefore = project.recordedDecisions ?? [];
  const newPending = pendingBefore.filter((item) => item.id !== id);
  const newRecorded = recordedBefore.filter((item) => item.id !== id);
  return {
    project: { ...project, pendingDecisions: newPending, recordedDecisions: newRecorded },
    cleared_pending: pendingBefore.length !== newPending.length,
    cleared_recorded: recordedBefore.length !== newRecorded.length,
  };
}

function renderPrompt(decision: PendingDecision): string {
  const lines: string[] = [];
  lines.push(`【需要用户决定】${decision.question}`);
  if (decision.context) lines.push(`背景：${decision.context}`);
  if (decision.options.length > 0) {
    lines.push("可选项：");
    decision.options.forEach((option, index) => {
      const recommended = option.is_recommended ? "（推荐）" : "";
      const description = option.description ? ` - ${option.description}` : "";
      lines.push(`  ${index + 1}. [${option.value}] ${option.label}${recommended}${description}`);
    });
  }
  if (decision.default_value) lines.push(`默认值：${decision.default_value}`);
  if (decision.allow_custom) lines.push("用户也可以自行输入答案。");
  if (decision.multiple) lines.push("可多选。");
  lines.push("提问规范：一次只询问当前 decision.id 对应的单一主题，不要把多个独立主题合并成一个问题。");
  lines.push("复杂主题需拆成多个 decision 逐轮记录；世界观、人物设定、MVU 变量设计至少三轮追问后再进入写作或生成。");
  lines.push("MVU 变量设计至少分别确认：用途目标、变量清单、变量规格/初始值/更新条件，必要时再确认状态栏展示。");
  lines.push(`请向用户复述上述内容并收集回答；用户答完后调用 record_user_decision 写入答案（id=${decision.id}）。`);
  return lines.join("\n");
}
