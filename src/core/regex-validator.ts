import type { RegexScriptAsset } from "./mvu-assets.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export interface RegexValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: { total: number; display_count: number; prompt_count: number };
}

export function validateRegexScripts(scripts: RegexScriptAsset[]): RegexValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let display_count = 0;
  let prompt_count = 0;

  scripts.forEach((script, index) => {
    if (!script.scriptName?.trim()) errors.push({ field: `regex.${index}.scriptName`, severity: "error", message: "regex name 不能为空" });
    if (!script.findRegex?.trim()) {
      errors.push({ field: `regex.${index}.findRegex`, severity: "error", message: "findRegex 不能为空" });
      return;
    }
    if (!/^\/.+\/[a-z]*$/.test(script.findRegex)) {
      warnings.push({ field: `regex.${index}.findRegex`, severity: "warning", message: "建议使用 slash 风格 /pattern/flags" });
    }
    if (script.markdownOnly && script.promptOnly) {
      errors.push({ field: `regex.${index}`, severity: "error", message: "markdownOnly 与 promptOnly 不能同时为 true" });
    }
    if (script.markdownOnly) display_count++;
    if (script.promptOnly) prompt_count++;
    if (script.promptOnly && script.replaceString && script.replaceString.replace(/\$\d+/g, "").trim() !== "") {
      warnings.push({ field: `regex.${index}.replaceString`, severity: "warning", message: "promptOnly 规则建议替换为空字符串，避免向 AI 发送多余内容" });
    }
    if (script.placement.length === 0) errors.push({ field: `regex.${index}.placement`, severity: "error", message: "placement 不能为空" });
    if (script.placement.some((value) => value < 1 || value > 2)) warnings.push({ field: `regex.${index}.placement`, severity: "warning", message: "placement 通常使用 1（显示层）/2（提示词层）" });
    if ((script.minDepth ?? null) !== null && (script.maxDepth ?? null) !== null && (script.maxDepth as number) < (script.minDepth as number)) {
      errors.push({ field: `regex.${index}.depth`, severity: "error", message: "maxDepth 不能小于 minDepth" });
    }
  });

  // pair 完整性：display 与 prompt 数量不一致时提示
  if (display_count > 0 && prompt_count === 0) warnings.push({ field: "regex", severity: "warning", message: "存在 display 规则但缺少 promptOnly 隐藏规则，AI 仍会看到原文" });
  if (prompt_count > 0 && display_count === 0) warnings.push({ field: "regex", severity: "warning", message: "存在 prompt 隐藏规则但缺少 display 规则，用户不会看到美化效果" });

  return { ok: errors.length === 0, errors, warnings, summary: { total: scripts.length, display_count, prompt_count } };
}
