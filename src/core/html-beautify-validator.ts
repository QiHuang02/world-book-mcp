import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { issue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type HtmlBeautifyValidationResult = ValidationSection<{
  enabled: boolean;
  target: string;
  statusbar_enabled: boolean;
  global_enabled: boolean;
  regex_count: number;
}> & { valid: boolean };

export function validateHtmlBeautifyConfig(input: { html: HtmlBeautifyConfig; mvu?: MvuConfig; characterCardConfig?: CharacterCardConfig }): HtmlBeautifyValidationResult {
  const { html, mvu, characterCardConfig } = input;
  const issues: ValidationIssue[] = [];
  if (!html.enabled) return withValid(section({ summary: summary(html) }));

  const needsStatusbar = html.target === "statusbar" || html.target === "both";
  const needsGlobal = html.target === "global" || html.target === "both";

  if (needsStatusbar) {
    if (!html.statusbar.enabled) issues.push(issue({ code: "html.statusbar.disabled", field: "statusbar.enabled", severity: "error", message: "target 包含 statusbar 时 statusbar.enabled 必须为 true" }));
    if (!html.statusbar.html.trim()) issues.push(issue({ code: "html.statusbar.empty", field: "statusbar.html", severity: "error", message: "statusbar.html 不能为空" }));
    if (/<script\b/i.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.script", field: "statusbar.html", severity: "warning", message: "状态栏 HTML 包含 <script>，请确认安全性" }));
    if (/(^|[\s,{])(?:body|html|\*)\s*[{,]/i.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.global_selector", field: "statusbar.html", severity: "error", message: "CSS 禁止 body/html/* 全局选择器，请使用作用域 class" }));
    if (!/\.wbm-statusbar|class=["'][^"']*wbm-statusbar/.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.missing_scope", field: "statusbar.html", severity: "error", message: "HTML 状态栏必须包含 .wbm-statusbar 作用域 class" }));
    if (/https?:\/\/|@import|<link\b|<img\b[^>]+src=["']https?:/i.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.external_url", field: "statusbar.html", severity: "error", message: "HTML 美化不得依赖外部 URL、外部字体或外部图片" }));
    if (/\{\{format_message_variable::stat_data\}\}/.test(html.statusbar.html) && !mvu?.enabled) issues.push(issue({ code: "html.statusbar.mvu_required", field: "statusbar.html", severity: "error", message: "状态栏使用 {{format_message_variable::stat_data}} 时必须启用 MVU" }));
    if (/\b(?:let|const)\b|=>/.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.modern_js", field: "statusbar.html", severity: "warning", message: "酒馆内嵌环境建议使用 var 和 function，避免 let/const/箭头函数" }));
    if (!/prefers-reduced-motion/.test(html.statusbar.html)) issues.push(issue({ code: "html.statusbar.reduced_motion", field: "statusbar.html", severity: "warning", message: "建议添加 prefers-reduced-motion 动画降级" }));
    if (!mvu?.enabled) issues.push(issue({ code: "html.statusbar.no_mvu", field: "statusbar", severity: "warning", message: "状态栏通常配合 MVU 使用；当前项目未启用 MVU" }));
    if (characterCardConfig) {
      [characterCardConfig.card.first_mes, ...characterCardConfig.card.alternate_greetings].forEach((greeting, index) => {
        if (!greeting.includes("<StatusPlaceHolderImpl/>")) issues.push(issue({ code: "html.greeting.missing_status_placeholder", field: index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`, severity: "error", message: "角色卡启用 MVU/HTML 状态栏时开场白必须包含 <StatusPlaceHolderImpl/>" }));
      });
    }
  }

  if (needsGlobal) {
    if (!html.global.enabled) issues.push(issue({ code: "html.global.disabled", field: "global.enabled", severity: "error", message: "target 包含 global 时 global.enabled 必须为 true" }));
    if (html.global.regex_scripts.length === 0) issues.push(issue({ code: "html.global.empty_regex", field: "global.regex_scripts", severity: "error", message: "全局美化至少需要一个 regex script" }));
    html.global.regex_scripts.forEach((script, index) => {
      if (!script.name.trim()) issues.push(issue({ code: "html.regex.empty_name", field: `global.regex_scripts.${index}.name`, severity: "error", message: "regex script name 不能为空" }));
      if (!script.findRegex.trim()) issues.push(issue({ code: "html.regex.empty_find", field: `global.regex_scripts.${index}.findRegex`, severity: "error", message: "regex script findRegex 不能为空" }));
      if (script.placement.length === 0) issues.push(issue({ code: "html.regex.empty_placement", field: `global.regex_scripts.${index}.placement`, severity: "error", message: "regex script placement 不能为空" }));
    });
  }

  return withValid(section({ ...splitIssues(issues), summary: summary(html) }));
}

function summary(html: HtmlBeautifyConfig): HtmlBeautifyValidationResult["summary"] {
  return { enabled: html.enabled, target: html.target, statusbar_enabled: html.statusbar.enabled, global_enabled: html.global.enabled, regex_count: html.global.regex_scripts.length + (html.statusbar.enabled ? 1 : 0) + (html.statusbar.hide_regex ? 1 : 0) };
}
