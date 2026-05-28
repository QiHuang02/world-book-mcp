import type { RegexScriptAsset } from "./mvu-assets.js";
import { hasBareStatDataMacro, hasCdata } from "./statusbar-html-normalizer.js";
import { normalizeIssue, type ValidationIssue } from "./validation-types.js";

export function validateRegexScripts(scripts: RegexScriptAsset[]): { ok: boolean; warnings: ValidationIssue[]; errors: ValidationIssue[]; summary: { count: number } } {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  for (const script of scripts) {
    if (script.markdownOnly && script.promptOnly) errors.push(normalizeIssue({ field: script.scriptName, message: "regex script 不能同时设置 markdownOnly 和 promptOnly", severity: "error" }));
    if (script.promptOnly && script.replaceString.trim()) warnings.push(normalizeIssue({ field: script.scriptName, message: "promptOnly 脚本的 replaceString 应为空字符串以避免泄漏", severity: "warning" }));
    if (hasCdata(script.replaceString)) errors.push(normalizeIssue({ code: "regex.replace.cdata", field: script.scriptName, message: "regex replaceString 不应包含 CDATA 包裹", severity: "error" }));
    if (isStatusbarDisplayRegex(script) && hasBareStatDataMacro(script.replaceString)) errors.push(normalizeIssue({ code: "regex.statusbar.bare_stat_data", field: script.scriptName, message: "状态栏 regex replaceString 不应使用裸 {{stat_data...}}，请改用 {{format_message_variable::...}}", severity: "error" }));
    if (isStatusbarDisplayRegex(script) && /<script\b/i.test(script.replaceString)) warnings.push(normalizeIssue({ code: "regex.statusbar.script", field: script.scriptName, message: "状态栏 regex replaceString 不建议包含 <script>", severity: "warning" }));
    if (isStatusbarDisplayRegex(script) && /https?:\/\//i.test(script.replaceString)) errors.push(normalizeIssue({ code: "regex.statusbar.external_url", field: script.scriptName, message: "状态栏 regex replaceString 不应引用外部 URL", severity: "error" }));
  }
  const displayScripts = scripts.filter((script) => script.markdownOnly && !script.promptOnly);
  for (const display of displayScripts) {
    const paired = scripts.some((script) => script.promptOnly && script.findRegex === display.findRegex);
    if (!paired) warnings.push(normalizeIssue({ field: display.scriptName, message: "展示 regex 缺少 promptOnly 配对隐藏规则", severity: "warning" }));
  }
  return { ok: errors.length === 0, warnings, errors, summary: { count: scripts.length } };
}

function isStatusbarDisplayRegex(script: RegexScriptAsset): boolean {
  return script.markdownOnly && !script.promptOnly && (/状态栏/.test(script.scriptName) || /StatusPlaceHolderImpl/.test(script.findRegex));
}
