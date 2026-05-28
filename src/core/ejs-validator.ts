import type { EjsConfig } from "../schemas/ejs.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeEjsConfig } from "./ejs-analyzer.js";
import { analyzeMvuPaths } from "./mvu-path-analyzer.js";
import { normalizeIssue, sectionFromIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type EjsValidationResult = ValidationSection<ReturnType<typeof summary>>;

export function validateEjsConfig(input: { ejs: EjsConfig; mvu?: MvuConfig }): EjsValidationResult {
  const { ejs, mvu } = input;
  const issues: ValidationIssue[] = [];
  const entries = ejs.entries ?? [];
  if (!mvu && entries.length > 0) issues.push(normalizeIssue({ code: "ejs.requires_mvu", field: "mvu", severity: "error", message: "EJS active 时必须启用 MVU" }));
  const fullPaths = new Set<string>();
  const hidden = new Set<string>();
  if (mvu) {
    const analysis = analyzeMvuPaths(mvu);
    const root = mvu.variableListPath ?? "stat_data";
    for (const p of analysis.schemaPaths) fullPaths.add(`${root}.${p.path}`);
    for (const p of analysis.hiddenPaths) hidden.add(`${root}.${p}`);
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const analysis = analyzeEjsConfig(ejs);
  for (const [index, entry] of entries.entries()) {
    if (!entry.content.trim()) issues.push(normalizeIssue({ code: "ejs.content.empty", field: `entries.${index}.content`, severity: "error", message: "active EJS content 不能为空" }));
    if (entry.role === "stage" && entry.enabled) issues.push(normalizeIssue({ code: "ejs.stage.enabled", field: `entries.${index}.enabled`, severity: "error", message: "stage 条目必须 enabled=false" }));
    if (entry.role === "stage" && entry.constant) issues.push(normalizeIssue({ code: "ejs.stage.constant", field: `entries.${index}.constant`, severity: "warning", message: "stage 条目通常应 constant=false，由 controller 通过 await getwi() 加载" }));
    if (/^@preprocessing\b/m.test(entry.content) || /^@@preprocessing\b/m.test(entry.content)) {
      if (/^@generate_before\b/m.test(entry.content)) issues.push(normalizeIssue({ code: "ejs.preprocessing.conflict", field: `entries.${index}.content`, severity: "warning", message: "@@preprocessing 用于世界书激活前处理，避免与 @generate_before 等生成期 decorator 混用" }));
      if (!/^@@preprocessing\b/m.test(entry.content)) issues.push(normalizeIssue({ code: "ejs.preprocessing.single_at", field: `entries.${index}.content`, severity: "warning", message: "教程推荐使用 @@preprocessing 而不是 @preprocessing" }));
    }
    for (const path of entry.variablePaths) validateVariablePath(path, `entries.${index}.variablePaths`, mvu, fullPaths, hidden, issues);
    if (entry.role === "controller") {
      for (const stage of entry.stages ?? []) {
        const target = byName.get(stage.targetSliceId) ?? byName.get(stage.name);
        if (!target) issues.push(normalizeIssue({ code: "ejs.stage.missing", field: `entries.${index}.stages`, severity: "error", message: `controller 指向不存在的 stage：${stage.targetSliceId}` }));
        else if (target.role !== "stage") issues.push(normalizeIssue({ code: "ejs.stage.not_stage", field: `entries.${index}.stages`, severity: "error", message: `controller target 不是 stage：${stage.targetSliceId}` }));
      }
    }
  }
  for (const path of analysis.contentVariablePaths) validateVariablePath(path, "content", mvu, fullPaths, hidden, issues);
  for (const ref of analysis.unawaitedGetwiRefs) issues.push(normalizeIssue({ code: "ejs.getwi.await_missing", field: ref.entryName, severity: "error", message: `getwi('${ref.ref}') 前必须使用 await` }));
  return withValid(sectionFromIssues(issues, summary(ejs)));
}

function validateVariablePath(path: string, field: string, mvu: MvuConfig | undefined, fullPaths: Set<string>, hidden: Set<string>, issues: ValidationIssue[]): void {
  const root = mvu?.variableListPath ?? "stat_data";
  const rawNormalized = path.trim().replace(/\[(\d+)\]/g, ".$1").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
  const normalized = rawNormalized === root || rawNormalized.startsWith(`${root}.`) ? rawNormalized : `${root}.${rawNormalized}`;
  if (!path.startsWith(`${root}.`) && path !== root) issues.push(normalizeIssue({ code: "ejs.variable.path_prefix", field, severity: "error", message: `EJS 变量路径必须使用完整 ${root}. 前缀：${path}` }));
  if (mvu && fullPaths.size > 0 && !fullPaths.has(normalized)) issues.push(normalizeIssue({ code: "ejs.variable.unknown", field, severity: "error", message: `EJS 引用不存在的 MVU 变量：${normalized}` }));
  if (hidden.has(normalized)) issues.push(normalizeIssue({ code: "ejs.variable.hidden", field, severity: "error", message: `EJS 不允许引用 hidden 变量：${normalized}` }));
}

function summary(ejs: EjsConfig) { return { enabled: ejs.entries.length > 0, active_slice_count: ejs.entries.length, controller_count: ejs.entries.filter((e) => e.role === "controller").length, stage_count: ejs.entries.filter((e) => e.role === "stage").length, inline_count: ejs.entries.filter((e) => e.role === "inline").length, helper_count: ejs.entries.filter((e) => e.role === "helper").length, variable_path_count: ejs.entries.reduce((sum, e) => sum + e.variablePaths.length, 0) }; }
