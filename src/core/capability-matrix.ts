import type { WorldbookTaskClass } from "./task-classifier.js";

export type CoverageLevel = "complete" | "partial" | "planned";
export type DecisionHint = "auto" | "prefer_clarification";

export interface CapabilityMatrixEntry {
  task_type: WorldbookTaskClass;
  purpose: string;
  status: CoverageLevel;
  decision_hint: DecisionHint;
  primary_tools: string[];
  optional_tools: string[];
  missing_or_planned: string[];
  recommended_workflow: string[];
}

const MATRIX: Record<WorldbookTaskClass, Omit<CapabilityMatrixEntry, "decision_hint">> = {
  original_character_card: {
    task_type: "original_character_card",
    purpose: "原创角色卡：世界观/人设条目/开场白/可选 MVU-EJS-HTML/最终角色卡 JSON。",
    status: "partial",
    primary_tools: ["create_worldbuilding_outline", "submit_worldbuilding_summary", "plan_worldbook_entries", "upsert_worldbook_entries", "validate_worldbook_draft", "upsert_character_profile", "upsert_character_profile", "validate_greetings", "validate_character_card_config", "generate_character_card_json"],
    optional_tools: ["create_mvu_schema_template", "create_ejs_template", "create_html_beautify_template", "lint_project_content", "create_final_review_report"],
    missing_or_planned: ["create_character_basic_entry_template", "create_character_personality_entry_template", "validate_character_entry_structure", "create_worldbook_entry_plan"],
    recommended_workflow: ["classify_worldbook_task", "create_worldbuilding_outline", "submit_worldbuilding_summary", "create_worldbook_entry_plan", "upsert_worldbook_entries", "validate_worldbook_draft", "upsert_character_profile", "upsert_character_profile", "validate_greetings", "create_final_review_report", "generate_character_card_json"],
  },
  derivative_extraction: {
    task_type: "derivative_extraction",
    purpose: "二创提取：接收 AI 整理后的原始素材/搜索摘要，形成结构化提取结果并转世界书/角色卡。",
    status: "partial",
    primary_tools: ["ingest_text_source", "ingest_web_research", "create_extraction_outline", "submit_extraction_result", "plan_worldbook_entries", "upsert_worldbook_entries", "validate_worldbook_draft"],
    optional_tools: ["generate_worldbook_json", "upsert_character_profile", "generate_character_card_json"],
    missing_or_planned: ["create_derivative_extraction_template", "submit_derivative_extraction_outline", "validate_derivative_extraction_outline"],
    recommended_workflow: ["ingest_text_source", "create_derivative_extraction_template", "submit_derivative_extraction_outline", "validate_derivative_extraction_outline", "submit_extraction_result", "create_worldbook_entry_plan", "upsert_worldbook_entries", "create_final_review_report"],
  },
  worldbuilding_only: {
    task_type: "worldbuilding_only",
    purpose: "纯世界观设计与世界书：从概念设计到条目化导出。",
    status: "partial",
    primary_tools: ["create_worldbuilding_outline", "submit_worldbuilding_summary", "validate_worldbuilding_summary", "submit_extraction_result", "plan_worldbook_entries", "upsert_worldbook_entries", "validate_worldbook_draft", "generate_worldbook_json"],
    optional_tools: ["lint_project_content", "create_final_review_report"],
    missing_or_planned: ["classify_worldbuilding_type", "create_worldbuilding_design_template", "validate_worldbuilding_design", "create_worldbook_entry_plan"],
    recommended_workflow: ["create_worldbuilding_design_template", "validate_worldbuilding_design", "classify_worldbook_card_type", "create_worldbook_entry_plan", "upsert_worldbook_entries", "validate_worldbook_draft", "generate_worldbook_json"],
  },
  item_ability_equipment: {
    task_type: "item_ability_equipment",
    purpose: "物品/能力/装备条目：按类型生成与校验世界书条目。",
    status: "partial",
    primary_tools: ["get_entry_template", "upsert_worldbook_entries", "validate_worldbook_draft"],
    optional_tools: ["update_worldbook_draft_entries", "generate_worldbook_json"],
    missing_or_planned: ["validate_item_entry"],
    recommended_workflow: ["get_entry_template", "validate_item_entry", "upsert_worldbook_entries", "validate_worldbook_draft"],
  },
  style_extraction: {
    task_type: "style_extraction",
    purpose: "文风提取/设定：把 AI 整理出的文风特征转为可触发或常驻世界书规则。",
    status: "planned",
    primary_tools: ["ingest_text_source", "lint_worldbook_content"],
    optional_tools: ["upsert_worldbook_entries", "validate_worldbook_draft"],
    missing_or_planned: ["create_style_extraction_template", "submit_style_profile", "build_style_worldbook_entries"],
    recommended_workflow: ["ingest_text_source", "create_style_extraction_template", "submit_style_profile", "build_style_worldbook_entries", "validate_worldbook_draft"],
  },
  chapter_extraction: {
    task_type: "chapter_extraction",
    purpose: "故事/章节提取：按章节行号和事件变化构建绿灯章节条目。",
    status: "planned",
    primary_tools: ["ingest_text_source", "submit_extraction_result", "plan_worldbook_entries"],
    optional_tools: ["upsert_worldbook_entries", "validate_worldbook_draft"],
    missing_or_planned: ["create_chapter_extraction_template", "build_chapter_worldbook_entries"],
    recommended_workflow: ["ingest_text_source", "create_chapter_extraction_template", "build_chapter_worldbook_entries", "validate_worldbook_draft"],
  },
  modify_existing: {
    task_type: "modify_existing",
    purpose: "修改已有世界书：导入、查询、创建补丁、预览并应用。",
    status: "complete",
    primary_tools: ["import_worldbook_json", "query_worldbook", "create_worldbook_patch", "preview_worldbook_patch", "apply_worldbook_patch"],
    optional_tools: ["validate_worldbook_draft", "generate_worldbook_json"],
    missing_or_planned: [],
    recommended_workflow: ["import_worldbook_json", "query_worldbook", "create_worldbook_patch", "preview_worldbook_patch", "apply_worldbook_patch"],
  },
  query_existing: {
    task_type: "query_existing",
    purpose: "查询已有世界书。",
    status: "complete",
    primary_tools: ["query_worldbook"],
    optional_tools: ["query_character_card"],
    missing_or_planned: [],
    recommended_workflow: ["query_worldbook"],
  },
  mvu_zod: {
    task_type: "mvu_zod",
    purpose: "MVU ZOD 变量系统：模板、配置、校验、资产构建并合入角色卡。",
    status: "partial",
    primary_tools: ["create_mvu_schema_template", "submit_mvu_config", "validate_mvu_config", "build_mvu_assets"],
    optional_tools: ["validate_greetings", "generate_character_card_json"],
    missing_or_planned: ["增强 validate_mvu_config 的 ZOD 细则检查"],
    recommended_workflow: ["create_mvu_schema_template", "submit_mvu_config", "validate_mvu_config", "build_mvu_assets", "generate_character_card_json"],
  },
  ejs_dynamic: {
    task_type: "ejs_dynamic",
    purpose: "EJS 动态内容：依赖 MVU 变量，构建 controller/stage/inline 世界书条目。",
    status: "partial",
    primary_tools: ["create_ejs_template", "submit_ejs_config", "validate_ejs_config", "build_ejs_entries"],
    optional_tools: ["validate_mvu_config", "generate_character_card_json"],
    missing_or_planned: ["create_ejs_phase_plan", "增强 validate_ejs_config 的边界/装饰器检查"],
    recommended_workflow: ["validate_mvu_config", "create_ejs_phase_plan", "create_ejs_template", "submit_ejs_config", "validate_ejs_config", "build_ejs_entries"],
  },
  html_beautify: {
    task_type: "html_beautify",
    purpose: "HTML 前端美化：状态栏/全局/开场选择器正则资产。",
    status: "partial",
    primary_tools: ["create_html_beautify_template", "submit_html_beautify_config", "validate_html_beautify_config", "build_html_beautify_assets"],
    optional_tools: ["build_mvu_assets", "generate_character_card_json"],
    missing_or_planned: ["create_html_regex_pair_template", "validate_regex_scripts", "增强 validate_html_beautify_config"],
    recommended_workflow: ["create_html_regex_pair_template", "create_html_beautify_template", "submit_html_beautify_config", "validate_html_beautify_config", "build_html_beautify_assets"],
  },
  content_lint: {
    task_type: "content_lint",
    purpose: "禁词扫描/写作优化：扫描文本、项目所有产物并生成报告。",
    status: "partial",
    primary_tools: ["lint_worldbook_content", "lint_project_content", "create_final_review_report"],
    optional_tools: [],
    missing_or_planned: ["create_writing_optimization_report", "扩展 content-lint 类别与词库"],
    recommended_workflow: ["lint_worldbook_content", "lint_project_content", "create_writing_optimization_report", "create_final_review_report"],
  },
};

export function getCapabilityMatrix(taskType?: WorldbookTaskClass): { entries: CapabilityMatrixEntry[]; summary: Record<CoverageLevel, number> } {
  const allEntries: CapabilityMatrixEntry[] = Object.values(MATRIX).map((entry) => ({ ...entry, decision_hint: decisionHintFor(entry.task_type) }));
  const entries = taskType ? allEntries.filter((entry) => entry.task_type === taskType) : allEntries;
  return {
    entries,
    summary: {
      complete: entries.filter((entry) => entry.status === "complete").length,
      partial: entries.filter((entry) => entry.status === "partial").length,
      planned: entries.filter((entry) => entry.status === "planned").length,
    },
  };
}

function decisionHintFor(taskType: WorldbookTaskClass): DecisionHint {
  switch (taskType) {
    case "query_existing":
    case "modify_existing":
    case "content_lint":
      return "auto";
    default:
      return "prefer_clarification";
  }
}
