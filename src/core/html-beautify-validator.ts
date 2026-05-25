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
    // 6 条硬性红线检查
    validateHtmlRedLines(html.statusbar.html, "statusbar.html", issues);
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
      // 对 replaceString 中的 HTML 内容也执行红线检查
      if (script.replaceString && script.replaceString.length > 50) {
        validateHtmlRedLines(script.replaceString, `global.regex_scripts.${index}.replaceString`, issues);
      }
    });
  }

  return withValid(section({ ...splitIssues(issues), summary: summary(html) }));
}

/**
 * 检查 HTML 内容是否违反 6 条硬性红线。
 * 红线 3（外部字体）和红线 4（外部图片）已由 external_url 检查覆盖。
 */
function validateHtmlRedLines(htmlContent: string, fieldPrefix: string, issues: ValidationIssue[]): void {
  // 红线 1：禁止 emoji 字符作为图标（检测 Unicode emoji 范围和 HTML 实体 emoji）
  if (/&#x[12][0-9a-fA-F]{3,4};|[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2764}\u{2665}\u{2666}\u{2660}\u{2663}]/u.test(htmlContent)) {
    issues.push(issue({ code: "html.redline.emoji_icon", field: fieldPrefix, severity: "error", message: "禁止使用 emoji 字符作为图标，必须用内联 SVG 替代" }));
  }

  // 红线 2：禁止使用 vh 单位（应使用 dvh）
  if (/:\s*[^;]*\d+vh\b/.test(htmlContent) && !/:\s*[^;]*\d+dvh/.test(htmlContent)) {
    issues.push(issue({ code: "html.redline.vh_unit", field: fieldPrefix, severity: "error", message: "禁止使用 vh 单位设定高度，酒馆 iframe 环境中 vh 计算不可靠，请使用 dvh" }));
  }

  // 红线 5：禁止 position: absolute 撑高页面主体
  if (/position\s*:\s*absolute/.test(htmlContent)) {
    issues.push(issue({ code: "html.redline.absolute_layout", field: fieldPrefix, severity: "warning", message: "检测到 position: absolute，请确认未用于撑高页面主体布局（装饰元素可用 absolute，主体布局必须用 flex/grid）" }));
  }

  // 红线 6：禁止 let/const 和箭头函数
  if (/\b(?:let|const)\b|=>/.test(htmlContent)) {
    issues.push(issue({ code: "html.redline.modern_js", field: fieldPrefix, severity: "error", message: "禁止使用 let/const/箭头函数，部分内嵌浏览器为旧版 WebView，请使用 var 和 function" }));
  }
}

function summary(html: HtmlBeautifyConfig): HtmlBeautifyValidationResult["summary"] {
  return { enabled: html.enabled, target: html.target, statusbar_enabled: html.statusbar.enabled, global_enabled: html.global.enabled, regex_count: html.global.regex_scripts.length + (html.statusbar.enabled ? 1 : 0) + (html.statusbar.hide_regex ? 1 : 0) };
}
