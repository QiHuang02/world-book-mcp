import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import { sectionStatus, type ProjectValidationReport } from "./validation-types.js";

export type DeliveryStatus = "ok" | "warning" | "blocking";

export interface DeliveryChecklistItem {
  section: string;
  status: DeliveryStatus;
  message: string;
  related_tools: string[];
}

export interface DeliveryChecklistResult {
  export_target: "worldbook" | "character_card";
  ready_to_export: boolean;
  blocking_count: number;
  warning_count: number;
  high_warning: boolean;
  high_warning_threshold: number;
  items: DeliveryChecklistItem[];
  review: ProjectValidationReport;
}

export function createDeliveryChecklist(input: { project: Project; export_target: "worldbook" | "character_card" }): DeliveryChecklistResult {
  const review = validateProject(input.project, { scope: "delivery", export_target: input.export_target });
  const items: DeliveryChecklistItem[] = [];
  pushSection(items, review, "plan", "项目计划与用户决策", ["update_plan", "record_user_decision", "list_user_decisions"]);
  pushSection(items, review, "worldbook", "世界书 draft", ["validate_draft", "list_draft_slices", "update_draft_field"], false, "worldbook_draft");
  if (input.export_target === "character_card") pushSection(items, review, "character_card", "角色卡配置与开场白", ["validate_draft", "update_draft_field"]);
  else if (input.project.characterCardConfig) pushSection(items, review, "character_card", "角色卡配置（非本次导出目标）", ["validate_draft"], true);
  if (input.project.mvuConfig?.enabled) pushSection(items, review, "mvu", "MVU schema/initvar/update_rules", ["validate_draft", "build_assets"]);
  if (input.project.ejsConfig?.enabled) pushSection(items, review, "ejs", "EJS 与 MVU 一致性", ["validate_draft", "build_assets"]);
  if (input.project.htmlBeautifyConfig?.enabled) pushSection(items, review, "html", "HTML 状态栏/正则资产", ["validate_draft", "build_assets"]);
  pushSection(items, review, "content_lint", "内容禁词与具体性 lint", ["lint_project_content", "create_writing_optimization_report"]);
  pushSection(items, review, "writing_optimization", "写作优化检查", ["create_writing_optimization_report", "lint_project_content"]);
  const pendingSection = review.sections.pending_decisions;
  const pendingCount = (pendingSection?.summary as { count?: number } | undefined)?.count ?? 0;
  if (pendingCount > 0) {
    items.push({ section: "pending_decisions", status: "blocking", message: `存在 ${pendingCount} 个未解决的用户决策`, related_tools: ["record_user_decision", "list_user_decisions"] });
  }

  const blocking_count = items.filter((item) => item.status === "blocking").length;
  const warning_count = items.filter((item) => item.status === "warning").length;
  const high_warning_threshold = 5;
  return { export_target: input.export_target, ready_to_export: blocking_count === 0 && review.ready_to_export, blocking_count, warning_count, high_warning: warning_count >= high_warning_threshold, high_warning_threshold, items, review };
}

function pushSection(items: DeliveryChecklistItem[], review: ProjectValidationReport, section: string, label: string, related_tools: string[], downgradeBlocking = false, itemSection = section): void {
  const rawStatus = sectionStatus(review.sections[section], "ok");
  const status = downgradeBlocking && rawStatus === "blocking" ? "warning" : rawStatus;
  items.push({ section: itemSection, status, message: status === "ok" ? `${label}通过` : status === "blocking" ? `${label}存在阻塞项` : `${label}存在警告或建议`, related_tools });
}
