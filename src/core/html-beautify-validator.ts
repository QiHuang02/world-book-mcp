import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import type { MvuConfig } from "../schemas/mvu.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export interface HtmlBeautifyValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    enabled: boolean;
    target: string;
    statusbar_enabled: boolean;
    global_enabled: boolean;
    regex_count: number;
  };
}

export function validateHtmlBeautifyConfig(input: { html: HtmlBeautifyConfig; mvu?: MvuConfig; characterCardConfig?: CharacterCardConfig }): HtmlBeautifyValidationResult {
  const { html, mvu, characterCardConfig } = input;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!html.enabled) return { valid: true, errors, warnings, summary: summary(html) };

  const needsStatusbar = html.target === "statusbar" || html.target === "both";
  const needsGlobal = html.target === "global" || html.target === "both";

  if (needsStatusbar) {
    if (!html.statusbar.enabled) errors.push({ field: "statusbar.enabled", severity: "error", message: "target 包含 statusbar 时 statusbar.enabled 必须为 true" });
    if (!html.statusbar.html.trim()) errors.push({ field: "statusbar.html", severity: "error", message: "statusbar.html 不能为空" });
    if (/<script\b/i.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "状态栏 HTML 包含 <script>，请确认安全性" });
    if (/(^|[\s,{])(?:body|html|\*)\s*[{,]/i.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "CSS 可能包含全局选择器，建议使用作用域 class" });
    if (!html.statusbar.html.includes("wbm-statusbar")) warnings.push({ field: "statusbar.html", severity: "warning", message: "建议包含 wbm-statusbar 作用域 class" });
    if (/https?:\/\/|@import|<link\b|<img\b[^>]+src=["']https?:/i.test(html.statusbar.html)) errors.push({ field: "statusbar.html", severity: "error", message: "HTML 美化不得依赖外部 URL、外部字体或外部图片" });
    if (/\b(?:let|const)\b|=>/.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "酒馆内嵌环境建议使用 var 和 function，避免 let/const/箭头函数" });
    if (/[^d]vh\b/.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "高度单位建议使用 dvh，并提供必要降级" });
    if (!/prefers-reduced-motion/.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "建议添加 prefers-reduced-motion 动画降级" });
    if (/[❤💖💗⭐✨🔥]/u.test(html.statusbar.html)) warnings.push({ field: "statusbar.html", severity: "warning", message: "图标建议使用内联 SVG，避免 emoji 跨平台差异" });
    if (!mvu?.enabled) warnings.push({ field: "statusbar", severity: "warning", message: "状态栏通常配合 MVU 使用；当前项目未启用 MVU" });
    if (characterCardConfig) {
      const greetings = [characterCardConfig.card.first_mes, ...characterCardConfig.card.alternate_greetings];
      greetings.forEach((greeting, index) => {
        if (!greeting.includes("<StatusPlaceHolderImpl/>")) {
          warnings.push({ field: index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`, severity: "warning", message: "状态栏启用时开场白建议包含 <StatusPlaceHolderImpl/>" });
        }
      });
    }
  }

  if (needsGlobal) {
    if (!html.global.enabled) errors.push({ field: "global.enabled", severity: "error", message: "target 包含 global 时 global.enabled 必须为 true" });
    if (html.global.regex_scripts.length === 0) errors.push({ field: "global.regex_scripts", severity: "error", message: "全局美化至少需要一个 regex script" });
    html.global.regex_scripts.forEach((script, index) => {
      if (!script.name.trim()) errors.push({ field: `global.regex_scripts.${index}.name`, severity: "error", message: "regex script name 不能为空" });
      if (!script.findRegex.trim()) errors.push({ field: `global.regex_scripts.${index}.findRegex`, severity: "error", message: "regex script findRegex 不能为空" });
      if (script.placement.length === 0) errors.push({ field: `global.regex_scripts.${index}.placement`, severity: "error", message: "regex script placement 不能为空" });
    });
  }

  return { valid: errors.length === 0, errors, warnings, summary: summary(html) };
}

function summary(html: HtmlBeautifyConfig): HtmlBeautifyValidationResult["summary"] {
  return {
    enabled: html.enabled,
    target: html.target,
    statusbar_enabled: html.statusbar.enabled,
    global_enabled: html.global.enabled,
    regex_count: html.global.regex_scripts.length + (html.statusbar.enabled ? 1 : 0) + (html.statusbar.hide_regex ? 1 : 0),
  };
}
