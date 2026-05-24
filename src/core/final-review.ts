import type { Project } from "../schemas/project.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";
import { validateEjsConfig } from "./ejs-validator.js";
import { validateHtmlBeautifyConfig } from "./html-beautify-validator.js";
import { validateMvuConfig } from "./mvu-validator.js";
import { lintProjectContent } from "./project-lint.js";
import { validateWorldbookDraft, type ValidationIssue } from "./worldbook-validator.js";
import { validateWorldbuildingSummary } from "./worldbuilding.js";
import { createWritingOptimizationReport } from "./writing-optimization-report.js";

export interface FinalReviewReport {
  ok: boolean;
  sections: Record<string, { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; summary?: unknown }>;
  recommendations: string[];
}

/**
 * 决定某个 section 在交付清单里应不应该阻塞导出 / 仅警告 / 通过。
 * 这是 final-review 模块对外暴露的统一策略，delivery-checklist 直接消费，
 * 避免在两边重复实现"errors=阻塞、warnings=警告"的判定。
 */
export type DeliveryStatus = "ok" | "warning" | "blocking";

export function sectionDeliveryStatus(section: FinalReviewReport["sections"][string] | undefined, fallback: DeliveryStatus = "warning"): DeliveryStatus {
  if (!section) return fallback;
  if (section.errors.length > 0) return "blocking";
  if (section.warnings.length > 0) return "warning";
  return "ok";
}

export function createFinalReviewReport(project: Project): FinalReviewReport {
  const sections: FinalReviewReport["sections"] = {};
  const recommendations: string[] = [];

  if (project.worldbuildingSummary) {
    const result = validateWorldbuildingSummary(project.worldbuildingSummary);
    sections.worldbuilding = result;
  } else {
    // 缺少世界观总纲只是建议性提示（很多二创/同人项目根本不需要），所以保持 ok=true 但发出 warning。
    // 这里有意与其它 section "有 warning -> ok=false" 的风格不同；delivery-checklist 用 sectionDeliveryStatus
    // 把这个 section 视为 warning 而不是 blocking。
    sections.worldbuilding = { ok: true, errors: [], warnings: [{ field: "worldbuildingSummary", severity: "warning", message: "项目未保存世界观总纲；原创项目建议补充" }] };
  }

  if (project.draft) {
    const result = validateWorldbookDraft(project.draft);
    sections.worldbook = { ok: result.valid, errors: result.errors, warnings: result.warnings, summary: result.summary };
  } else {
    sections.worldbook = { ok: false, errors: [{ field: "draft", severity: "error", message: "项目尚未保存 worldbook draft" }], warnings: [] };
  }

  if (project.characterCardConfig) {
    const result = validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled });
    sections.character_card = { ok: result.valid, errors: result.errors, warnings: result.warnings, summary: result.summary };
  } else {
    sections.character_card = { ok: true, errors: [], warnings: [{ field: "characterCardConfig", severity: "warning", message: "项目未配置角色卡；如只导出世界书可忽略" }] };
  }

  if (project.mvuConfig) {
    const result = validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig });
    sections.mvu = { ok: result.valid, errors: result.errors, warnings: result.warnings, summary: result.summary };
  }
  if (project.htmlBeautifyConfig) {
    const result = validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig });
    sections.html_beautify = { ok: result.valid, errors: result.errors, warnings: result.warnings, summary: result.summary };
  }
  if (project.ejsConfig) {
    const result = validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig });
    sections.ejs = { ok: result.valid, errors: result.errors, warnings: result.warnings, summary: result.summary };
  }

  const lint = lintProjectContent(project);
  const pending = project.pendingDecisions ?? [];
  if (pending.length > 0) {
    sections.pending_decisions = {
      ok: true,
      errors: [],
      warnings: pending.map((decision) => ({ field: `pendingDecisions.${decision.id}`, severity: "warning", message: `未解决决策：${decision.question}`, suggestion: decision.source_tool ? `回答后调用 record_user_decision，然后回到 ${decision.source_tool}` : "回答后调用 record_user_decision" })),
      summary: { count: pending.length, ids: pending.map((decision) => decision.id) },
    };
    recommendations.push("项目存在未解决的用户决策，建议先调用 record_user_decision");
  } else {
    sections.pending_decisions = { ok: true, errors: [], warnings: [], summary: { count: 0 } };
  }
  const writingReport = createWritingOptimizationReport({ project });
  sections.writing_optimization = {
    ok: writingReport.ok,
    errors: writingReport.issues.filter((issue) => issue.severity === "error").map((issue) => ({ field: issue.path, severity: "error", message: issue.term ? `文本问题：${issue.term}` : issue.message, suggestion: issue.suggestion })),
    warnings: writingReport.issues.filter((issue) => issue.severity === "warning").map((issue) => ({ field: issue.path, severity: "warning", message: issue.term ? `文本问题：${issue.term}` : issue.message, suggestion: issue.suggestion })),
    summary: writingReport.summary,
  };
  sections.content_lint = {
    ok: lint.ok,
    errors: lint.issues.filter((issue) => issue.severity === "error").map((issue) => ({ field: issue.path, severity: "error", message: issue.term ? `文本问题：${issue.term}` : issue.message, suggestion: issue.suggestion })),
    warnings: lint.issues.filter((issue) => issue.severity === "warning").map((issue) => ({ field: issue.path, severity: "warning", message: issue.term ? `文本问题：${issue.term}` : issue.message, suggestion: issue.suggestion })),
    summary: lint.summary,
  };

  if (project.ejsConfig?.enabled && !project.mvuConfig?.enabled) recommendations.push("启用 EJS 前必须启用 MVU");
  if (project.htmlBeautifyConfig?.enabled && !project.characterCardConfig) recommendations.push("HTML 美化资产需要通过角色卡 JSON 承载");
  if (project.characterCardConfig && !project.draft) recommendations.push("角色卡建议嵌入世界书，先完成 draft 再导出");

  return { ok: Object.values(sections).every((section) => section.ok), sections, recommendations };
}
