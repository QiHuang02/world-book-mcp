import type { Project } from "../schemas/project.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";
import { validateEjsConfig } from "./ejs-validator.js";
import { validateHtmlBeautifyConfig } from "./html-beautify-validator.js";
import { analyzeMvuPaths } from "./mvu-path-analyzer.js";
import { validateMvuConfig } from "./mvu-validator.js";
import { lintProjectContent } from "./project-lint.js";
import { normalizeIssue, section, sectionFromIssues, sectionStatus, SCOPE_SECTIONS, type ProjectValidationReport, type ProjectValidationScope, type ValidationIssue, type ValidationSection } from "./validation-types.js";
import { validateWorldbookDraft } from "./worldbook-validator.js";
import { createWritingOptimizationReport } from "./writing-optimization-report.js";

export function validateProject(project: Project, options: { scope?: ProjectValidationScope; export_target?: "worldbook" | "character_card" } = {}): ProjectValidationReport {
  const scope = options.scope ?? "all";
  const sections: Record<string, ValidationSection> = {};
  const recommendations: string[] = [];
  const include = (name: ProjectValidationScope): boolean => scope === "all" || scope === name || (scope === "delivery" && ["plan", "worldbook", "character_card", "mvu", "ejs", "html", "content"].includes(name));

  if (include("plan")) {
    sections.plan = validatePlanSection(project);
    sections.pending_decisions = validatePendingDecisionsSection(project);
  }
  if (include("worldbook")) sections.worldbook = validateWorldbookSection(project, options.export_target);
  if (include("character_card")) sections.character_card = validateCharacterCardSection(project);
  const mvuAnalysis = project.mvuConfig ? analyzeMvuPaths(project.mvuConfig) : undefined;
  if (include("mvu")) sections.mvu = project.mvuConfig ? validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig, analysis: mvuAnalysis }) : section({ summary: { enabled: false, schema_path_count: 0, initvar_path_count: 0, update_rule_path_count: 0, readonly_path_count: 0, hidden_path_count: 0 } });
  if (include("ejs")) sections.ejs = project.ejsConfig ? validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig, mvuAnalysis }) : section({ summary: { enabled: false, template_type: "none", entry_count: 0, variable_path_count: 0, content_variable_path_count: 0 } });
  if (include("html")) sections.html = project.htmlBeautifyConfig ? validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : section({ summary: { enabled: false, target: "none", statusbar_enabled: false, global_enabled: false, regex_count: 0 } });
  if (include("content")) Object.assign(sections, validateContentSections(project));
  if (include("assets")) sections.assets = validateAssetsSection(project);
  if (include("style")) sections.style = section({ summary: { checked: false }, infos: [normalizeIssue({ code: "style.scope.delegated", field: "style", severity: "info", message: "style scope 由 style_profile draft 和内容 lint 间接检查" })] });
  if (include("chapter")) sections.chapter = section({ summary: { checked: false }, infos: [normalizeIssue({ code: "chapter.scope.delegated", field: "chapter", severity: "info", message: "chapter scope 由 chapter_outline draft 和世界书条目间接检查" })] });

  if (project.ejsConfig?.enabled && !project.mvuConfig?.enabled) recommendations.push("启用 EJS 前必须启用 MVU");
  if (project.htmlBeautifyConfig?.enabled && !project.characterCardConfig) recommendations.push("HTML 美化资产需要通过角色卡 JSON 承载");
  if (project.characterCardConfig && (!project.draft || project.draft.length === 0)) recommendations.push("角色卡建议嵌入世界书，先完成 draft 再导出");
  if ((project.pendingDecisions ?? []).length > 0) recommendations.push("项目存在未解决的用户决策，建议先调用 record_user_decision");

  const ok = Object.values(sections).every((item) => item.ok);
  const ready_to_export = deliveryReady(sections, project, options.export_target);
  return { ok, ready_to_export, scope_used: scope, sections, recommendations };
}

/** 暴露给调用方查询某个 scope 实际产出的 section keys。和 SCOPE_SECTIONS 一致。 */
export function sectionsForScope(scope: ProjectValidationScope): readonly string[] {
  return SCOPE_SECTIONS[scope];
}

function validatePlanSection(project: Project): ValidationSection {
  const issues: ValidationIssue[] = [];
  if (!project.name?.trim()) issues.push(normalizeIssue({ code: "plan.name.empty", field: "name", severity: "error", message: "项目 name 不能为空" }));
  return sectionFromIssues(issues, { pending_decision_count: project.pendingDecisions?.length ?? 0, output_target: project.plan.output_target });
}

function validatePendingDecisionsSection(project: Project): ValidationSection {
  const pending = project.pendingDecisions ?? [];
  return sectionFromIssues(pending.map((decision) => normalizeIssue({ code: "pending_decisions.unresolved", field: `pendingDecisions.${decision.id}`, severity: "warning", message: `未解决决策：${decision.question}`, suggestion: decision.source_tool ? `回答后调用 record_user_decision，然后回到 ${decision.source_tool}` : "回答后调用 record_user_decision" })), { count: pending.length, ids: pending.map((decision) => decision.id) });
}

function validateWorldbookSection(project: Project, exportTarget?: "worldbook" | "character_card"): ValidationSection {
  if (!project.draft || project.draft.length === 0) {
    const severity = exportTarget === "character_card" ? "warning" : "error";
    return sectionFromIssues([normalizeIssue({ code: "worldbook.draft.empty", field: "draft", severity, message: "项目尚未保存 worldbook draft" })], { entry_count: 0, constant_count: 0, triggered_count: 0 });
  }
  const result = validateWorldbookDraft(project.draft);
  return section({ errors: result.errors.map(normalizeIssue), warnings: result.warnings.map(normalizeIssue), infos: [], summary: result.summary });
}

function validateCharacterCardSection(project: Project): ValidationSection {
  if (!project.characterCardConfig) return sectionFromIssues([normalizeIssue({ code: "character_card.missing", field: "characterCardConfig", severity: "error", message: "项目未配置角色卡；如只导出世界书可忽略" })], { worldbook_entry_count: 0, greeting_count: 0, description_empty: true });
  return validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled, htmlStatusbarEnabled: project.htmlBeautifyConfig?.enabled && (project.htmlBeautifyConfig.target === "statusbar" || project.htmlBeautifyConfig.target === "both") });
}

function validateContentSections(project: Project): Record<string, ValidationSection> {
  const lint = lintProjectContent(project);
  const writing = createWritingOptimizationReport({ project });
  return {
    content_lint: sectionFromIssues(lint.issues.map((item) => normalizeIssue({ code: `content.${item.severity}`, field: item.path, severity: item.severity, message: item.term ? `文本问题：${item.term}` : item.message, suggestion: item.suggestion })), lint.summary),
    writing_optimization: sectionFromIssues(writing.issues.map((item) => normalizeIssue({ code: `writing.${item.severity}`, field: item.path, severity: item.severity, message: item.term ? `文本问题：${item.term}` : item.message, suggestion: item.suggestion })), writing.summary),
  };
}

function validateAssetsSection(project: Project): ValidationSection {
  const issues: ValidationIssue[] = [];
  if (project.ejsConfig?.enabled && !project.mvuConfig?.enabled) issues.push(normalizeIssue({ code: "assets.ejs_requires_mvu", field: "ejsConfig", severity: "error", message: "EJS 资产依赖 MVU schema" }));
  if (project.htmlBeautifyConfig?.enabled && !project.characterCardConfig) issues.push(normalizeIssue({ code: "assets.html_requires_card", field: "htmlBeautifyConfig", severity: "error", message: "HTML 状态栏/正则资产需要角色卡承载" }));
  return sectionFromIssues(issues, { mvu_enabled: Boolean(project.mvuConfig?.enabled), ejs_enabled: Boolean(project.ejsConfig?.enabled), html_enabled: Boolean(project.htmlBeautifyConfig?.enabled) });
}

function deliveryReady(sections: Record<string, ValidationSection>, project: Project, exportTarget?: "worldbook" | "character_card"): boolean {
  const blockingSections = ["plan", "worldbook", "mvu", "ejs", "html", "content_lint", "writing_optimization"];
  if (exportTarget === "character_card" || project.plan.output_target === "character_card" || project.plan.output_target === "both") blockingSections.push("character_card");
  return blockingSections.every((name) => sectionStatus(sections[name], "ok") !== "blocking");
}
