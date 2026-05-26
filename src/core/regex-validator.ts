import type { RegexScriptAsset } from "./mvu-assets.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export function validateRegexScripts(scripts: RegexScriptAsset[]): { ok: boolean; warnings: ValidationIssue[]; errors: ValidationIssue[]; summary: { count: number } } {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  for (const script of scripts) {
    if (script.markdownOnly && script.promptOnly) errors.push({ field: script.scriptName, message: "regex script 不能同时设置 markdownOnly 和 promptOnly", severity: "error" });
    if (script.promptOnly && script.replaceString.trim()) warnings.push({ field: script.scriptName, message: "promptOnly 脚本的 replaceString 应为空字符串以避免泄漏", severity: "warning" });
  }
  const displayScripts = scripts.filter((script) => script.markdownOnly && !script.promptOnly);
  for (const display of displayScripts) {
    const paired = scripts.some((script) => script.promptOnly && script.findRegex === display.findRegex);
    if (!paired) warnings.push({ field: display.scriptName, message: "展示 regex 缺少 promptOnly 配对隐藏规则", severity: "warning" });
  }
  return { ok: errors.length === 0, warnings, errors, summary: { count: scripts.length } };
}
