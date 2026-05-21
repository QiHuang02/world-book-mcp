import type { Project } from "../schemas/project.js";
import { createFinalReviewReport, type FinalReviewReport } from "./final-review.js";

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
    items.push({ section: "worldbuilding", status: review.sections.worldbuilding?.ok ? "ok" : "warning", message: review.sections.worldbuilding?.ok ? "世界观信息齐备" : "世界观信息存在警告", related_tools: ["validate_worldbuilding_summary", "validate_worldbuilding_design"] });
  }

  // 世界书 draft
  if (!input.project.draft || input.project.draft.length === 0) {
    items.push({ section: "worldbook_draft", status: input.export_target === "worldbook" ? "blocking" : "warning", message: "项目尚未保存世界书 draft", related_tools: ["draft_worldbook_entries", "create_worldbook_draft_template"] });
  } else {
    items.push({ section: "worldbook_draft", status: review.sections.worldbook?.ok ? "ok" : "blocking", message: review.sections.worldbook?.ok ? "世界书 draft 校验通过" : "世界书 draft 存在阻塞性错误", related_tools: ["validate_worldbook_draft", "update_worldbook_draft_entries"] });
  }

  // 角色卡
  if (input.export_target === "character_card") {
    if (!input.project.characterCardConfig) {
      items.push({ section: "character_card", status: "blocking", message: "项目尚未保存角色卡配置", related_tools: ["create_character_card_template", "submit_character_card_config"] });
    } else {
      items.push({ section: "character_card", status: review.sections.character_card?.ok ? "ok" : "blocking", message: review.sections.character_card?.ok ? "角色卡配置通过校验" : "角色卡配置存在错误", related_tools: ["validate_character_card_config", "validate_greetings"] });
    }
  } else if (input.project.characterCardConfig) {
    items.push({ section: "character_card", status: review.sections.character_card?.ok ? "ok" : "warning", message: "导出目标为世界书，角色卡配置仅供参考", related_tools: ["validate_character_card_config"] });
  }

  // MVU / EJS / HTML 仅在启用时检查
  if (input.project.mvuConfig?.enabled) {
    items.push({ section: "mvu", status: review.sections.mvu?.ok ? "ok" : "blocking", message: review.sections.mvu?.ok ? "MVU 配置通过" : "MVU 配置存在错误", related_tools: ["validate_mvu_config", "build_mvu_assets"] });
  }
  if (input.project.htmlBeautifyConfig?.enabled) {
    items.push({ section: "html_beautify", status: review.sections.html_beautify?.ok ? "ok" : "blocking", message: review.sections.html_beautify?.ok ? "HTML 美化通过" : "HTML 美化存在错误", related_tools: ["validate_html_beautify_config", "build_html_beautify_assets"] });
  }
  if (input.project.ejsConfig?.enabled) {
    items.push({ section: "ejs", status: review.sections.ejs?.ok ? "ok" : "blocking", message: review.sections.ejs?.ok ? "EJS 配置通过" : "EJS 配置存在错误", related_tools: ["validate_ejs_config", "build_ejs_entries"] });
  }

  // 写作优化
  const writingOk = review.sections.writing_optimization?.ok ?? true;
  items.push({ section: "writing_optimization", status: writingOk ? "ok" : "blocking", message: writingOk ? "写作优化检查无错误" : "写作优化存在阻塞性错误", related_tools: ["create_writing_optimization_report", "lint_project_content"] });

  // 未解决决策
  const pendingCount = (input.project.pendingDecisions ?? []).length;
  if (pendingCount > 0) {
    items.push({ section: "pending_decisions", status: "blocking", message: `存在 ${pendingCount} 个未解决的用户决策，导出前需先回答`, related_tools: ["record_user_decision", "clear_user_decision", "list_user_decisions"] });
  } else {
    items.push({ section: "pending_decisions", status: "ok", message: "无未解决的用户决策", related_tools: ["list_user_decisions"] });
  }

  const blocking_count = items.filter((item) => item.status === "blocking").length;
  const warning_count = items.filter((item) => item.status === "warning").length;

  return {
    export_target: input.export_target,
    ready_to_export: blocking_count === 0,
    blocking_count,
    warning_count,
    items,
    review,
  };
}
