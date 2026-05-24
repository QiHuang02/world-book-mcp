import type { Project } from "../schemas/project.js";
import { createFinalReviewReport, sectionDeliveryStatus, type DeliveryStatus, type FinalReviewReport } from "./final-review.js";

export type { DeliveryStatus } from "./final-review.js";

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
  /** 当 warning_count 超过 high_warning_threshold 时给一个明显提示，便于上层 UI/日志单独高亮。 */
  high_warning: boolean;
  high_warning_threshold: number;
  items: DeliveryChecklistItem[];
  review: FinalReviewReport;
}

export function createDeliveryChecklist(input: { project: Project; export_target: "worldbook" | "character_card" }): DeliveryChecklistResult {
  const review = createFinalReviewReport(input.project);
  const items: DeliveryChecklistItem[] = [];

  // 世界观
  if (!input.project.worldbuildingSummary && !input.project.derivativeOutline) {
    items.push({ section: "worldbuilding", status: "warning", message: "未保存世界观总纲或二创 outline，原创项目建议补充", related_tools: ["submit_worldbuilding_summary", "submit_derivative_extraction_outline"] });
  } else {
    const status = sectionDeliveryStatus(review.sections.worldbuilding, "warning");
    items.push({ section: "worldbuilding", status: status === "blocking" ? "warning" : status, message: status === "ok" ? "世界观信息齐备" : "世界观信息存在警告", related_tools: ["validate_worldbuilding_summary", "validate_worldbuilding_design"] });
  }

  // 世界书 draft
  if (!input.project.draft || input.project.draft.length === 0) {
    items.push({ section: "worldbook_draft", status: input.export_target === "worldbook" ? "blocking" : "warning", message: "项目尚未保存世界书 draft", related_tools: ["create_draft_slice"] });
  } else {
    const status = sectionDeliveryStatus(review.sections.worldbook, "warning");
    items.push({ section: "worldbook_draft", status, message: status === "ok" ? "世界书 draft 校验通过" : status === "blocking" ? "世界书 draft 存在阻塞性错误" : "世界书 draft 仅有警告", related_tools: ["validate_draft", "list_draft_slices", "update_draft_field"] });
  }

  // 角色卡
  if (input.export_target === "character_card") {
    if (!input.project.characterCardConfig) {
      items.push({ section: "character_card", status: "blocking", message: "项目尚未保存角色卡配置", related_tools: ["create_draft_slice", "update_draft_field"] });
    } else {
      const status = sectionDeliveryStatus(review.sections.character_card, "blocking");
      items.push({ section: "character_card", status, message: status === "ok" ? "角色卡配置通过校验" : status === "blocking" ? "角色卡配置存在错误" : "角色卡配置仅有警告", related_tools: ["validate_draft", "update_draft_field"] });
    }
  } else if (input.project.characterCardConfig) {
    const status = sectionDeliveryStatus(review.sections.character_card, "warning");
    // 导出目标是世界书时，角色卡仅供参考，不应当作 blocking。
    items.push({ section: "character_card", status: status === "blocking" ? "warning" : status, message: "导出目标为世界书，角色卡配置仅供参考", related_tools: ["validate_draft"] });
  }

  // MVU / EJS / HTML 仅在启用时检查
  if (input.project.mvuConfig?.enabled) {
    const status = sectionDeliveryStatus(review.sections.mvu, "blocking");
    items.push({ section: "mvu", status, message: status === "ok" ? "MVU 配置通过" : status === "blocking" ? "MVU 配置存在错误" : "MVU 配置仅有警告", related_tools: ["validate_draft", "build_assets"] });
  }
  if (input.project.htmlBeautifyConfig?.enabled) {
    const status = sectionDeliveryStatus(review.sections.html_beautify, "blocking");
    items.push({ section: "html_beautify", status, message: status === "ok" ? "HTML 美化通过" : status === "blocking" ? "HTML 美化存在错误" : "HTML 美化仅有警告", related_tools: ["validate_draft", "build_assets"] });
  }
  if (input.project.ejsConfig?.enabled) {
    const status = sectionDeliveryStatus(review.sections.ejs, "blocking");
    items.push({ section: "ejs", status, message: status === "ok" ? "EJS 配置通过" : status === "blocking" ? "EJS 配置存在错误" : "EJS 配置仅有警告", related_tools: ["validate_draft", "build_assets"] });
  }

  // 写作优化：errors 阻塞，warnings 不阻塞但需要单独提示
  const writingStatus = sectionDeliveryStatus(review.sections.writing_optimization, "ok");
  items.push({ section: "writing_optimization", status: writingStatus, message: writingStatus === "ok" ? "写作优化检查无错误" : writingStatus === "blocking" ? "写作优化存在阻塞性错误" : "写作优化存在警告，建议复核", related_tools: ["create_writing_optimization_report", "lint_project_content"] });

  // 未解决决策
  const pendingCount = (input.project.pendingDecisions ?? []).length;
  if (pendingCount > 0) {
    items.push({ section: "pending_decisions", status: "blocking", message: `存在 ${pendingCount} 个未解决的用户决策，导出前需先回答`, related_tools: ["record_user_decision", "clear_user_decision", "list_user_decisions"] });
  } else {
    items.push({ section: "pending_decisions", status: "ok", message: "无未解决的用户决策", related_tools: ["list_user_decisions"] });
  }

  const blocking_count = items.filter((item) => item.status === "blocking").length;
  const warning_count = items.filter((item) => item.status === "warning").length;
  const high_warning_threshold = 5;

  return {
    export_target: input.export_target,
    ready_to_export: blocking_count === 0,
    blocking_count,
    warning_count,
    high_warning: warning_count >= high_warning_threshold,
    high_warning_threshold,
    items,
    review,
  };
}
