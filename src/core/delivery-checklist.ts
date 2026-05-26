import type { Project } from "../schemas/project.js";
import { validateProject } from "./project-validator.js";
import { resolveStrictReviewMode, strictSectionStatus, type StrictReviewMode } from "./strict-review.js";
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

export function createDeliveryChecklist(input: { project: Project; export_target: "worldbook" | "character_card"; strict_review?: boolean | StrictReviewMode }): DeliveryChecklistResult {
  const strictMode = resolveStrictReviewMode({ strict_review: input.strict_review, project: input.project });
  const review = validateProject(input.project, { scope: "delivery", export_target: input.export_target, strict_review: strictMode });
  const items: DeliveryChecklistItem[] = [];
  pushSection(items, review, "plan", "项目计划与用户决策", ["update_plan", "update_plan(mode='record_decision')", "update_plan(mode='list_decisions')"], strictMode);
  pushSection(items, review, "worldbook", "世界书 draft", ["validate_draft", "list_draft_slices", "update_draft_field"], strictMode, false, "worldbook_draft");
  if (input.export_target === "character_card") pushSection(items, review, "character_card", "角色卡配置与开场白", ["validate_draft", "update_character_profile", "update_character_greetings"], strictMode);
  else if (input.project.characterCardConfig) pushSection(items, review, "character_card", "角色卡配置（非本次导出目标）", ["validate_draft"], strictMode, true);
  if (input.project.mvuConfig?.enabled) pushSection(items, review, "mvu", "MVU schema/initvar/update_rules", ["validate_draft", "build_assets"], strictMode);
  if (input.project.ejsConfig?.enabled) pushSection(items, review, "ejs", "EJS 与 MVU 一致性", ["validate_draft", "build_assets"], strictMode);
  if (input.project.htmlBeautifyConfig?.enabled) pushSection(items, review, "html", "HTML 状态栏/正则资产", ["validate_draft", "build_assets"], strictMode);
  const pendingSection = review.sections.pending_decisions;
  const pendingCount = (pendingSection?.summary as { count?: number } | undefined)?.count ?? 0;
  if (pendingCount > 0) {
    items.push({ section: "pending_decisions", status: "blocking", message: `存在 ${pendingCount} 个未解决的用户决策`, related_tools: ["update_plan(mode='record_decision')", "update_plan(mode='list_decisions')"] });
  }

  const blocking_count = items.filter((item) => item.status === "blocking").length;
  const warning_count = items.filter((item) => item.status === "warning").length;
  const high_warning_threshold = 5;
  return { export_target: input.export_target, ready_to_export: blocking_count === 0 && review.ready_to_export, blocking_count, warning_count, high_warning: warning_count >= high_warning_threshold, high_warning_threshold, items, review };
}

function pushSection(items: DeliveryChecklistItem[], review: ProjectValidationReport, section: string, label: string, related_tools: string[], strictMode: StrictReviewMode = "off", downgradeBlocking = false, itemSection = section): void {
  const rawStatus = strictMode === "off" ? sectionStatus(review.sections[section], "ok") : strictSectionStatus(section, review.sections[section], strictMode);
  const status = downgradeBlocking && rawStatus === "blocking" ? "warning" : rawStatus;
  items.push({ section: itemSection, status, message: status === "ok" ? `${label}通过` : status === "blocking" ? `${label}存在阻塞项` : `${label}存在警告或建议`, related_tools });
}
