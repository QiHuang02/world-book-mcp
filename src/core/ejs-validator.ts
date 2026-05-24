import type { EjsConfig } from "../schemas/ejs.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeEjsConfig, normalizeEjsUiPath } from "./ejs-analyzer.js";
import { analyzeMvuPaths, toUiPath, type MvuPathAnalysis } from "./mvu-path-analyzer.js";
import { issue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type EjsValidationResult = ValidationSection<{ enabled: boolean; template_type: string; entry_count: number; variable_path_count: number; content_variable_path_count: number }> & { valid: boolean };

export function validateEjsConfig(input: { ejs: EjsConfig; mvu?: MvuConfig; mvuAnalysis?: MvuPathAnalysis }): EjsValidationResult {
  const { ejs, mvu } = input;
  const issues: ValidationIssue[] = [];
  const analysis = analyzeEjsConfig(ejs);
  const mvuAnalysis = input.mvuAnalysis ?? (mvu ? analyzeMvuPaths(mvu) : undefined);
  const schemaPaths = new Set((mvuAnalysis?.schema_paths ?? []).map((item) => toUiPath(item.path)));
  const hiddenPaths = new Set((mvuAnalysis?.hidden_paths ?? []).map(toUiPath));

  if (!ejs.enabled) return withValid(section({ summary: summary(ejs, analysis.content_variable_paths.length) }));
  if (!mvu?.enabled) issues.push(issue({ code: "ejs.mvu.disabled", field: "mvu", severity: "error", message: "EJS 依赖 MVU，启用 EJS 前必须启用 MVU" }));

  ejs.variable_paths.forEach((rawPath, index) => {
    const path = rawPath.trim();
    const normalized = normalizeEjsUiPath(path);
    if (!path.startsWith("stat_data")) issues.push(issue({ code: "ejs.variable_path.missing_stat_data", field: `variable_paths.${index}`, severity: "error", message: "EJS 变量路径必须使用完整 stat_data.xxx 路径" }));
    if (path === "stat_data") issues.push(issue({ code: "ejs.variable_path.too_broad", field: `variable_paths.${index}`, severity: "warning", message: "variable_paths 不应只写 stat_data，建议精确到叶子变量" }));
    if (/^stat_data[^.]/.test(path)) issues.push(issue({ code: "ejs.variable_path.fake_prefix", field: `variable_paths.${index}`, severity: "error", message: "变量路径疑似假前缀，应写成 stat_data.xxx" }));
    if (mvu?.enabled && schemaPaths.size > 0 && normalized && normalized !== "stat_data" && !schemaPaths.has(normalized)) issues.push(issue({ code: "ejs.variable_path.unknown_schema_path", field: `variable_paths.${index}`, severity: "error", message: `variable_paths 路径不存在于 MVU schema：${normalized}` }));
    if (hiddenPaths.has(normalized)) issues.push(issue({ code: "ejs.variable_path.hidden", field: `variable_paths.${index}`, severity: "error", message: `EJS 不应引用 $ hidden 变量：${normalized}` }));
  });

  for (const path of analysis.content_variable_paths) {
    if (!path.startsWith("stat_data.")) issues.push(issue({ code: "ejs.content_path.invalid", field: "entries.content", severity: "error", message: `EJS 内容中的变量路径必须是 stat_data.xxx：${path}` }));
    if (mvu?.enabled && schemaPaths.size > 0 && !schemaPaths.has(path)) issues.push(issue({ code: "ejs.content_path.unknown_schema_path", field: "entries.content", severity: "error", message: `EJS 内容引用的变量不存在于 MVU schema：${path}` }));
    if (hiddenPaths.has(path)) issues.push(issue({ code: "ejs.content_path.hidden", field: "entries.content", severity: "error", message: `EJS 内容不应读取 $ hidden 变量：${path}` }));
    if (!analysis.declared_variable_paths.includes(path)) issues.push(issue({ code: "ejs.variable_path.undeclared", field: "variable_paths", severity: "warning", message: `getvar/_.get 使用了但未登记到 variable_paths：${path}` }));
  }
  for (const path of analysis.declared_variable_paths) {
    if (path !== "stat_data" && !analysis.content_variable_paths.includes(path)) issues.push(issue({ code: "ejs.variable_path.unused", field: "variable_paths", severity: "info", message: `variable_paths 登记但内容中未使用：${path}` }));
  }

  if (ejs.entries.length === 0) issues.push(issue({ code: "ejs.entries.empty", field: "entries", severity: "error", message: "EJS entries 不能为空" }));
  if (!ejs.entries.some((entry) => entry.role === "controller" || entry.role === "inline")) issues.push(issue({ code: "ejs.entries.no_controller", field: "entries", severity: "error", message: "EJS 至少需要一个 controller 或 inline 条目" }));

  const names = new Set(ejs.entries.map((entry) => entry.name));
  ejs.entries.forEach((entry, index) => {
    if (!entry.name.trim()) issues.push(issue({ code: "ejs.entry.empty_name", field: `entries.${index}.name`, severity: "error", message: "EJS entry name 不能为空" }));
    if (!entry.content.trim()) issues.push(issue({ code: "ejs.entry.empty_content", field: `entries.${index}.content`, severity: "error", message: "EJS entry content 不能为空" }));
    if (entry.content.includes("<%") && !entry.content.includes("%>")) issues.push(issue({ code: "ejs.entry.unclosed_tag", field: `entries.${index}.content`, severity: "error", message: "EJS 标签未闭合：缺少 %>" }));
    if (/\b(?:const|let)\s+\w+\s*=\s*getvar\(/.test(entry.content)) issues.push(issue({ code: "ejs.entry.getvar_const", field: `entries.${index}.content`, severity: "warning", message: "读取阶段变量建议使用 var + typeof 防重复声明" }));
    if (/getvar\(/.test(entry.content) && !/typeof\s+\w+\s*===\s*['"]undefined['"]/.test(entry.content)) issues.push(issue({ code: "ejs.entry.getvar_typeof", field: `entries.${index}.content`, severity: "warning", message: "读取变量建议使用 typeof 防重复声明" }));
    if (/getvar\(/.test(entry.content) && !/\bvar\s+\w+\s*=\s*getvar\(/.test(entry.content)) issues.push(issue({ code: "ejs.entry.getvar_var", field: `entries.${index}.content`, severity: "warning", message: "读取变量建议使用 var 声明，避免 const/let 重复声明" }));
    if (/getwi\(/.test(entry.content) && !/await\s+getwi\(/.test(entry.content)) issues.push(issue({ code: "ejs.entry.getwi_await", field: `entries.${index}.content`, severity: "warning", message: "getwi 调用建议使用 await getwi(...)" }));
    if (/@preprocessing/.test(entry.content) && /@(generate_before|generate_after)/i.test(entry.content)) issues.push(issue({ code: "ejs.entry.preprocessing_conflict", field: `entries.${index}.content`, severity: "warning", message: "@preprocessing 不应与 @generate_before/@generate_after 同时使用" }));
    if (/==(?!=)/.test(entry.content)) issues.push(issue({ code: "ejs.entry.loose_equals", field: `entries.${index}.content`, severity: "warning", message: "字符串/状态比较建议使用 === 或 !==" }));
    if (entry.role === "controller") {
      if (!entry.enabled) issues.push(issue({ code: "ejs.controller.disabled", field: `entries.${index}.enabled`, severity: "warning", message: "controller 条目建议 enabled=true" }));
      if (!entry.constant) issues.push(issue({ code: "ejs.controller.not_constant", field: `entries.${index}.constant`, severity: "warning", message: "controller 条目建议 constant=true" }));
    }
    if (entry.role === "stage" && entry.enabled) issues.push(issue({ code: "ejs.stage.enabled", field: `entries.${index}.enabled`, severity: "warning", message: "被 getwi 加载的 stage 条目建议 enabled=false" }));
    for (const ref of analysis.entries[index]?.getwi_refs ?? []) {
      if (!names.has(ref)) issues.push(issue({ code: "ejs.getwi.missing_entry", field: `entries.${index}.content`, severity: "error", message: `getwi 引用的 stage/helper 条目不存在：${ref}` }));
      const target = ejs.entries.find((item) => item.name === ref);
      if (target?.role === "stage" && target.enabled) issues.push(issue({ code: "ejs.getwi.stage_enabled", field: `entries.${index}.content`, severity: "warning", message: `getwi 加载的 stage 条目应 enabled=false：${ref}` }));
    }
    // Multi-stage EJS validation
    const entryAnalysis = analysis.entries[index];
    if (entry.stages && entry.stages.length > 0) {
      if (entryAnalysis && entryAnalysis.condition_branch_count > 0 && entryAnalysis.condition_branch_count < entry.stages.length) {
        issues.push(issue({ code: "ejs.stages.branch_count_mismatch", field: `entries.${index}.stages`, severity: "warning", message: `定义了 ${entry.stages.length} 个阶段但内容中只有 ${entryAnalysis.condition_branch_count} 个条件分支` }));
      }
      if (entryAnalysis && !entryAnalysis.has_else_fallback && entry.stages.length > 1) {
        issues.push(issue({ code: "ejs.stages.no_else_fallback", field: `entries.${index}.content`, severity: "warning", message: "多阶段条目建议最后一个分支使用 else 兜底，避免条件遗漏" }));
      }
      for (const stage of entry.stages) {
        for (const varName of entryAnalysis?.stages.find((s) => s.name === stage.name)?.condition_variables ?? []) {
          const definedNames = new Set(entryAnalysis?.defined_names ?? []);
          if (!definedNames.has(varName)) {
            issues.push(issue({ code: "ejs.stages.undeclared_condition_var", field: `entries.${index}.stages`, severity: "info", message: `阶段 "${stage.name}" 条件引用变量 "${varName}"，确认已在内容中通过 getvar 声明` }));
          }
        }
      }
    }
  });

  return withValid(section({ ...splitIssues(issues), summary: summary(ejs, analysis.content_variable_paths.length) }));
}

function summary(ejs: EjsConfig, contentVariablePathCount: number): EjsValidationResult["summary"] {
  return { enabled: ejs.enabled, template_type: ejs.template_type, entry_count: ejs.entries.length, variable_path_count: ejs.variable_paths.length, content_variable_path_count: contentVariablePathCount };
}
