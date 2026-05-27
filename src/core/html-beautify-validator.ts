import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeMvuPaths } from "./mvu-path-analyzer.js";
import { normalizeIssue, sectionFromIssues, withValid, type ValidationSection } from "./validation-types.js";

export type HtmlBeautifyValidationResult = ValidationSection<ReturnType<typeof summary>>;
export function validateHtmlBeautifyConfig(input: { html: HtmlBeautifyConfig; mvu?: MvuConfig; characterCardConfig?: CharacterCardConfig }): HtmlBeautifyValidationResult {
  const { html, mvu, characterCardConfig } = input;
  const issues = [];
  const statusbarTarget = html.target === "statusbar" || html.target === "both";
  if (statusbarTarget && !html.statusbar.html.trim()) issues.push(normalizeIssue({ code: "html.statusbar.empty", field: "statusbar.html", severity: "error", message: "HTML 状态栏为空" }));
  if (statusbarTarget && !/wbm-statusbar/.test(html.statusbar.html + (html.statusbar.scopedCss ?? ""))) issues.push(normalizeIssue({ code: "html.scope.missing", field: "statusbar.html", severity: "error", message: "HTML 状态栏必须包含 .wbm-statusbar 作用域" }));
  if (/<script\b/i.test(html.statusbar.html)) issues.push(normalizeIssue({ code: "html.script.forbidden", field: "statusbar.html", severity: "error", message: "HTML 状态栏禁止包含 <script>" }));
  if (/https?:\/\//i.test(`${html.statusbar.html}\n${html.statusbar.scopedCss ?? ""}`)) issues.push(normalizeIssue({ code: "html.external_url", field: "statusbar", severity: "error", message: "HTML/CSS 禁止引用外部 URL" }));
  if (html.statusbar.scopedCss && /(^|\n)\s*(?:body|html|\*)\s*[{,]/.test(html.statusbar.scopedCss)) issues.push(normalizeIssue({ code: "html.css.global_selector", field: "statusbar.scopedCss", severity: "error", message: "CSS 不应使用 body/html/* 全局选择器" }));
  if (html.variablePaths.length > 0) {
    if (!mvu) issues.push(normalizeIssue({ code: "html.mvu_required", field: "variablePaths", severity: "error", message: "HTML variablePaths 依赖 MVU" }));
    else {
      const analysis = analyzeMvuPaths(mvu);
      const fullPaths = new Set(analysis.schema_paths.map((item) => `${mvu.variableListPath ?? "stat_data"}.${item.path}`));
      const hidden = new Set(analysis.hidden_paths.map((item) => `${mvu.variableListPath ?? "stat_data"}.${item}`));
      for (const path of html.variablePaths) { if (!fullPaths.has(path)) issues.push(normalizeIssue({ code: "html.variable.unknown", field: "variablePaths", severity: "error", message: `HTML 引用不存在的 MVU 变量：${path}` })); if (hidden.has(path)) issues.push(normalizeIssue({ code: "html.variable.hidden", field: "variablePaths", severity: "error", message: `HTML 不允许引用 hidden 变量：${path}` })); }
    }
  }
  if (statusbarTarget && characterCardConfig) for (const [index, greeting] of [characterCardConfig.card.first_mes, ...characterCardConfig.card.alternate_greetings].entries()) if (!greeting.includes("<StatusPlaceHolderImpl/>")) issues.push(normalizeIssue({ code: "html.placeholder.missing", field: index === 0 ? "first_mes" : `alternate_greetings.${index - 1}`, severity: "error", message: "启用 HTML 状态栏时开场白必须包含 <StatusPlaceHolderImpl/>" }));
  return withValid(sectionFromIssues(issues, summary(html)));
}
function summary(html: HtmlBeautifyConfig) { return { enabled: true, target: html.target, theme: html.theme, variable_path_count: html.variablePaths.length, generates_regex: html.regexPolicy.generateHideRegex || html.regexPolicy.generateStatusbarRegex }; }
