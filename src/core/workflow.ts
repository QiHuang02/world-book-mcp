export type WorkflowTaskType =
  | "from_text"
  | "from_web_research"
  | "original_world"
  | "original_character_card"
  | "derivative_extraction"
  | "worldbuilding_only"
  | "item_ability_equipment"
  | "style_extraction"
  | "chapter_extraction"
  | "modify_existing"
  | "query_existing"
  | "mvu_zod"
  | "ejs_dynamic"
  | "html_beautify"
  | "content_lint";

export interface WorkflowInput {
  task_type: WorkflowTaskType;
  wants_character_card?: boolean;
  wants_mvu?: boolean;
  wants_html?: boolean;
  wants_ejs?: boolean;
}

export function getWorkflow(input: WorkflowInput): { workflow: string[]; notes: string[] } {
  const commonNotes = [
    "生成 JSON 前必须调用 validate_worldbook_draft",
    "推荐用 upsert_worldbook_entry / upsert_worldbook_entries 写条目，避免手写完整 JSON",
    "网页搜索由宿主 AI 完成，MCP 只接收搜索摘要",
  ];
  if (input.wants_html && !input.wants_character_card) {
    commonNotes.push("HTML 美化资产需要通过角色卡 JSON 承载，建议同时设置 wants_character_card=true");
  }
  if (input.wants_mvu && !input.wants_character_card) {
    commonNotes.push("MVU/ZOD 资产需要通过角色卡 JSON 承载，建议同时设置 wants_character_card=true");
  }
  if (input.wants_ejs && !input.wants_character_card) {
    commonNotes.push("EJS entries 需要通过角色卡 JSON 承载，建议同时设置 wants_character_card=true");
  }
  if (input.wants_ejs && !input.wants_mvu) {
    commonNotes.push("EJS 依赖 MVU 变量，建议同时设置 wants_mvu=true");
  }

  switch (input.task_type) {
    case "from_text":
    case "derivative_extraction":
      return {
        workflow: withCharacterCard(input, extractionWorkflow("ingest_text_source")),
        notes: commonNotes,
      };
    case "from_web_research":
      return {
        workflow: withCharacterCard(input, extractionWorkflow("ingest_web_research")),
        notes: commonNotes,
      };
    case "original_world":
    case "worldbuilding_only":
      return {
        workflow: withCharacterCard(input, [
          "create_worldbuilding_outline",
          "submit_worldbuilding_summary",
          "validate_worldbuilding_summary",
          "submit_extraction_result",
          "plan_worldbook_entries",
          "create_worldbook_draft_template",
          "get_entry_template",
          "upsert_worldbook_entries",
          "validate_worldbook_draft",
          "lint_project_content",
          "create_final_review_report",
          "generate_worldbook_json",
        ]),
        notes: ["原创设定建议先完成世界观总纲，再整理为 extraction result 后提交", ...commonNotes],
      };
    case "original_character_card":
      return {
        workflow: withCharacterCard({ ...input, wants_character_card: true }, [
          "create_worldbuilding_outline",
          "submit_worldbuilding_summary",
          "validate_worldbuilding_summary",
          "submit_extraction_result",
          "plan_worldbook_entries",
          "create_worldbook_draft_template",
          "get_entry_template",
          "upsert_worldbook_entries",
          "validate_worldbook_draft",
          "lint_project_content",
          "create_final_review_report",
        ]),
        notes: ["角色卡 description 建议留空，角色信息写入世界书", ...commonNotes],
      };
    case "item_ability_equipment":
      return {
        workflow: withCharacterCard(input, ["get_entry_template", "upsert_worldbook_entries", "validate_worldbook_draft", "lint_project_content", "create_final_review_report", "generate_worldbook_json"]),
        notes: ["物品/能力/装备条目应保持 XML 包裹 YAML，并按触发策略设置 keys", ...commonNotes],
      };
    case "style_extraction":
      return {
        workflow: ["ingest_text_source", "create_style_extraction_outline", "submit_extraction_result", "lint_project_content"],
        notes: ["文风提取以写作规则和负面约束为主，不应照搬大段原文", ...commonNotes],
      };
    case "chapter_extraction":
      return {
        workflow: ["ingest_text_source", "create_chapter_extraction_outline", "submit_extraction_result", "plan_worldbook_entries", "upsert_worldbook_entries", "validate_worldbook_draft"],
        notes: ["章节提取应保留事件因果和角色状态变化，避免流水账", ...commonNotes],
      };
    case "modify_existing":
      return {
        workflow: ["import_worldbook_json", "query_worldbook", "create_worldbook_patch", "preview_worldbook_patch", "apply_worldbook_patch"],
        notes: ["修改已有世界书建议先导入并预览 patch，校验通过后再应用", ...commonNotes],
      };
    case "query_existing":
      return { workflow: ["query_worldbook"], notes: commonNotes };
    case "mvu_zod":
      return { workflow: ["create_mvu_schema_template", "submit_mvu_config", "validate_mvu_config", "build_mvu_assets", "create_final_review_report"], notes: commonNotes };
    case "ejs_dynamic":
      return { workflow: ["create_mvu_schema_template", "submit_mvu_config", "validate_mvu_config", "create_ejs_template", "submit_ejs_config", "validate_ejs_config", "build_ejs_entries", "create_final_review_report"], notes: ["EJS 依赖 MVU 变量", ...commonNotes] };
    case "html_beautify":
      return { workflow: ["create_html_beautify_template", "submit_html_beautify_config", "validate_html_beautify_config", "build_html_beautify_assets", "create_final_review_report"], notes: commonNotes };
    case "content_lint":
      return { workflow: ["lint_worldbook_content", "lint_project_content", "create_final_review_report"], notes: commonNotes };
  }
}

function extractionWorkflow(sourceTool: "ingest_text_source" | "ingest_web_research"): string[] {
  return [
    sourceTool,
    "create_extraction_outline",
    "submit_extraction_result",
    "plan_worldbook_entries",
    "create_worldbook_draft_template",
    "get_entry_template",
    "upsert_worldbook_entries",
    "validate_worldbook_draft",
    "lint_project_content",
    "create_final_review_report",
    "generate_worldbook_json",
    "query_worldbook",
  ];
}

function withCharacterCard(input: WorkflowInput, workflow: string[]): string[] {
  if (!input.wants_character_card) return workflow;
  return [
    ...workflow,
    "upsert_character_profile",
    ...(input.wants_mvu ? ["create_mvu_schema_template", "submit_mvu_config", "validate_mvu_config", "build_mvu_assets"] : []),
    ...(input.wants_html ? ["create_html_beautify_template", "submit_html_beautify_config", "validate_html_beautify_config", "build_html_beautify_assets"] : []),
    ...(input.wants_ejs ? ["create_ejs_template", "submit_ejs_config", "validate_ejs_config", "build_ejs_entries"] : []),
    "validate_character_card_config",
    "generate_character_card_json",
    "query_character_card",
  ];
}
