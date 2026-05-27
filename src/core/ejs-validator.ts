import type { EjsConfig } from "../schemas/ejs.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeMvuPaths } from "./mvu-path-analyzer.js";
import { normalizeIssue, sectionFromIssues, withValid, type ValidationSection } from "./validation-types.js";

export type EjsValidationResult = ValidationSection<ReturnType<typeof summary>>;
export function validateEjsConfig(input: { ejs: EjsConfig; mvu?: MvuConfig }): EjsValidationResult {
  const { ejs, mvu } = input;
  const issues = [];
  if (!mvu && ejs.entries.length > 0) issues.push(normalizeIssue({ code: "ejs.requires_mvu", field: "mvu", severity: "error", message: "EJS active 时必须启用 MVU" }));
  const fullPaths = new Set<string>();
  const hidden = new Set<string>();
  if (mvu) { const analysis = analyzeMvuPaths(mvu); for (const p of analysis.schema_paths) fullPaths.add(`${mvu.variableListPath ?? "stat_data"}.${p.path}`); for (const p of analysis.hidden_paths) hidden.add(`${mvu.variableListPath ?? "stat_data"}.${p}`); }
  const byId = new Map(ejs.entries.map((entry) => [entry.name, entry]));
  for (const [index, entry] of ejs.entries.entries()) {
    if (!entry.content.trim()) issues.push(normalizeIssue({ code: "ejs.content.empty", field: `entries.${index}.content`, severity: "error", message: "active EJS content 不能为空" }));
    if (entry.role === "stage" && entry.enabled) issues.push(normalizeIssue({ code: "ejs.stage.enabled", field: `entries.${index}.enabled`, severity: "error", message: "stage 条目必须 enabled=false" }));
    for (const path of entry.variablePaths) { if (mvu && !fullPaths.has(path)) issues.push(normalizeIssue({ code: "ejs.variable.unknown", field: `entries.${index}.variablePaths`, severity: "error", message: `EJS 引用不存在的 MVU 变量：${path}` })); if (hidden.has(path)) issues.push(normalizeIssue({ code: "ejs.variable.hidden", field: `entries.${index}.variablePaths`, severity: "error", message: `EJS 不允许引用 hidden 变量：${path}` })); }
    if (entry.role === "controller") for (const stage of entry.stages ?? []) { const target = byId.get(stage.targetSliceId) ?? byId.get(stage.name); if (!target) issues.push(normalizeIssue({ code: "ejs.stage.missing", field: `entries.${index}.stages`, severity: "error", message: `controller 指向不存在的 stage：${stage.targetSliceId}` })); else if (target.role !== "stage") issues.push(normalizeIssue({ code: "ejs.stage.not_stage", field: `entries.${index}.stages`, severity: "error", message: `controller target 不是 stage：${stage.targetSliceId}` })); }
  }
  return withValid(sectionFromIssues(issues, summary(ejs)));
}
function summary(ejs: EjsConfig) { return { enabled: ejs.entries.length > 0, active_slice_count: ejs.entries.length, controller_count: ejs.entries.filter((e) => e.role === "controller").length, stage_count: ejs.entries.filter((e) => e.role === "stage").length, inline_count: ejs.entries.filter((e) => e.role === "inline").length, helper_count: ejs.entries.filter((e) => e.role === "helper").length, variable_path_count: ejs.entries.reduce((sum, e) => sum + e.variablePaths.length, 0) }; }
