export type ToolUsageGuide = {
  tool: string;
  purpose: string;
  when_to_call: string;
  required_fields: string[];
  example_input: unknown;
  common_mistakes: string[];
  next_tools: string[];
};

const GUIDES: Record<string, ToolUsageGuide> = {
  init_project: guide("init_project", "初始化 .worldbook/project.json 与 .worldbook/draft/。", ["name"], { name: "项目名", kind: "character_card", if_exists: "return_existing" }, ["upsert_worldbook_entry", "upsert_character_profile"]),
  upsert_worldbook_entry: guide("upsert_worldbook_entry", "用简化字段新增或更新单个世界书条目，并写入 .worldbook/draft/<comment>.json。", ["project_id", "comment", "content"], { project_id: "project_xxx", comment: "角色A_基础设定", keys: ["角色A"], content: "..." }, ["validate_worldbook_draft", "generate_worldbook_json"]),
  upsert_worldbook_entries: guide("upsert_worldbook_entries", "批量新增或更新世界书分片草稿。", ["project_id", "entries"], { project_id: "project_xxx", entries: [{ comment: "条目", content: "..." }] }, ["list_worldbook_draft_entries", "validate_worldbook_draft"]),
  list_worldbook_draft_entries: guide("list_worldbook_draft_entries", "列出 .worldbook/draft/*.json 分片草稿，默认不返回正文。", ["project_id"], { project_id: "project_xxx", include_content: false }, ["get_worldbook_draft_entry", "upsert_worldbook_entry"]),
  get_worldbook_draft_entry: guide("get_worldbook_draft_entry", "按 comment 读取单个分片草稿。", ["project_id", "comment"], { project_id: "project_xxx", comment: "角色A_基础设定" }, ["upsert_worldbook_entry", "delete_worldbook_draft_entry"]),
  delete_worldbook_draft_entry: guide("delete_worldbook_draft_entry", "按 comment 删除单个分片草稿；删除后需重新导出最终 JSON。", ["project_id", "comment"], { project_id: "project_xxx", comment: "旧条目" }, ["list_worldbook_draft_entries", "validate_worldbook_draft"]),
  upsert_character_profile: guide("upsert_character_profile", "用简化字段创建或更新角色卡 profile。", ["project_id", "name"], { project_id: "project_xxx", name: "角色A", first_mes: "..." }, ["validate_character_card_config", "generate_character_card_json"]),
  ingest_text_source: guide("ingest_text_source", "保存用户提供的原始文本素材。", ["title", "content"], { title: "素材", content: "...", source_type: "notes" }, ["create_extraction_outline"]),
  ingest_web_research: guide("ingest_web_research", "保存宿主 AI 整理后的网页研究摘要；MCP 不联网。", ["topic", "items"], { topic: "作品", items: [{ title: "页面", summary: "摘要", facts: ["事实"] }] }, ["create_extraction_outline"]),
  create_extraction_outline: guide("create_extraction_outline", "返回结构化提取模板。", [], { project_id: "project_xxx", focus: ["characters", "world"] }, ["submit_extraction_result"]),
  submit_extraction_result: guide("submit_extraction_result", "提交主 AI 提取出的结构化事实，不接收原文全文。", ["project_id", "title"], { project_id: "project_xxx", title: "项目", characters: [], world: [], items: [], events: [] }, ["plan_worldbook_entries"]),
  plan_worldbook_entries: guide("plan_worldbook_entries", "根据 extraction 生成条目规划。", ["project_id"], { project_id: "project_xxx" }, ["get_entry_template", "upsert_worldbook_entries"]),
  generate_worldbook_json: guide("generate_worldbook_json", "合并 .worldbook/draft/*.json 并导出 SillyTavern 世界书 JSON。", ["project_id", "worldbook_name"], { project_id: "project_xxx", worldbook_name: "世界书" }, ["query_worldbook"]),
  import_worldbook_json: guide("import_worldbook_json", "导入已有世界书 JSON 为分片草稿。", ["path"], { path: "世界书.json" }, ["query_worldbook", "create_worldbook_patch"]),
  query_worldbook: guide("query_worldbook", "查询已有世界书 JSON。", ["path", "mode"], { path: "世界书.json", mode: "brief" }, []),
  create_worldbook_patch: guide("create_worldbook_patch", "为已导入世界书创建可预览 patch；新增条目使用简化 entry。", ["project_id", "operations"], { project_id: "project_xxx", operations: [{ op: "add_or_update_entry", entry: { comment: "条目", content: "..." } }] }, ["preview_worldbook_patch"]),
  preview_worldbook_patch: guide("preview_worldbook_patch", "预览世界书 patch diff 与校验。", ["project_id", "patch_id"], { project_id: "project_xxx", patch_id: "patch_xxx" }, ["apply_worldbook_patch"]),
  apply_worldbook_patch: guide("apply_worldbook_patch", "应用世界书 patch 并安全导出 JSON。", ["project_id", "patch_id"], { project_id: "project_xxx", patch_id: "patch_xxx", backup: true }, ["query_worldbook"]),
  import_character_card_json: guide("import_character_card_json", "导入 chara_card_v3 角色卡并提取 profile 与内嵌世界书草稿。", ["path"], { path: "角色卡.json" }, ["query_character_card", "create_character_card_patch"]),
  generate_character_card_json: guide("generate_character_card_json", "导出角色卡 JSON，并自动合并分片草稿与 MVU/HTML/EJS 资产。", ["project_id"], { project_id: "project_xxx" }, ["query_character_card"]),
  query_character_card: guide("query_character_card", "查询角色卡 JSON。", ["path", "mode"], { path: "角色卡.json", mode: "summary" }, []),
  create_character_card_patch: guide("create_character_card_patch", "创建角色卡 profile/worldbook patch。", ["project_id", "operations"], { project_id: "project_xxx", operations: [{ op: "update_profile", changes: { first_mes: "..." } }] }, ["preview_character_card_patch"]),
  preview_character_card_patch: guide("preview_character_card_patch", "预览角色卡 patch。", ["project_id", "patch_id"], { project_id: "project_xxx", patch_id: "card_patch_xxx" }, ["apply_character_card_patch"]),
  apply_character_card_patch: guide("apply_character_card_patch", "应用角色卡 patch 并安全导出 JSON。", ["project_id", "patch_id"], { project_id: "project_xxx", patch_id: "card_patch_xxx" }, ["query_character_card"]),
  create_mvu_schema_template: guide("create_mvu_schema_template", "创建 MVU/ZOD schema 模板。", ["character_names"], { character_names: ["角色A"] }, ["upsert_mvu_schema", "upsert_mvu_update_rules"]),
  upsert_mvu_schema: guide("upsert_mvu_schema", "局部更新 MVU schema_script、变量路径和启用状态。", ["project_id"], { project_id: "project_xxx", schema_script: "..." }, ["upsert_mvu_update_rules", "validate_mvu_config"]),
  upsert_mvu_update_rules: guide("upsert_mvu_update_rules", "局部更新 MVU initvar、update_rules 和 regex 开关。", ["project_id"], { project_id: "project_xxx", initvar: "...", update_rules: "..." }, ["validate_mvu_config", "build_mvu_assets"]),
  submit_mvu_config: guide("submit_mvu_config", "高级入口：提交完整 MVU config。普通修改优先用 upsert_mvu_schema / upsert_mvu_update_rules。", ["project_id", "mvu"], { project_id: "project_xxx", mvu: { enabled: true, style: "zod" } }, ["validate_mvu_config"]),
  validate_mvu_config: guide("validate_mvu_config", "校验 MVU 配置。", ["project_id"], { project_id: "project_xxx" }, ["build_mvu_assets"]),
  build_mvu_assets: guide("build_mvu_assets", "预览 MVU 将合并的资产。", ["project_id"], { project_id: "project_xxx" }, ["generate_character_card_json"]),
  create_html_beautify_template: guide("create_html_beautify_template", "创建 HTML 美化模板。", [], { project_id: "project_xxx", target: "statusbar", theme: "minimal" }, ["upsert_html_statusbar"]),
  upsert_html_statusbar: guide("upsert_html_statusbar", "局部更新 HTML 状态栏内容、主题和 hide_regex。", ["project_id"], { project_id: "project_xxx", html: "<div class=\"wbm-statusbar\">...</div>" }, ["validate_html_beautify_config"]),
  submit_html_beautify_config: guide("submit_html_beautify_config", "高级入口：提交完整 HTML 美化 config。普通状态栏修改优先用 upsert_html_statusbar。", ["project_id", "html"], { project_id: "project_xxx", html: { enabled: true } }, ["validate_html_beautify_config"]),
  validate_html_beautify_config: guide("validate_html_beautify_config", "校验 HTML 美化配置。", ["project_id"], { project_id: "project_xxx" }, ["build_html_beautify_assets"]),
  build_html_beautify_assets: guide("build_html_beautify_assets", "预览 HTML 美化 regex 资产。", ["project_id"], { project_id: "project_xxx" }, ["generate_character_card_json"]),
  create_html_regex_pair_template: guide("create_html_regex_pair_template", "高级入口：生成显示/隐藏 regex 对。", ["scope", "display_html"], { scope: "statusbar", display_html: "<div>...</div>" }, ["validate_regex_scripts"]),
  validate_regex_scripts: guide("validate_regex_scripts", "高级入口：校验 regex scripts。", ["scripts"], { scripts: [{ scriptName: "脚本", findRegex: "/x/g" }] }, []),
  create_ejs_phase_plan: guide("create_ejs_phase_plan", "创建 EJS 阶段规划。", ["character_name", "affection_path", "phases"], { character_name: "角色A", affection_path: "stat_data.角色A.好感度", phases: [{ name: "初识" }] }, ["create_ejs_template"]),
  create_ejs_template: guide("create_ejs_template", "创建 EJS 模板。", ["character_name"], { character_name: "角色A", template_type: "phase_profile" }, ["upsert_ejs_entry"]),
  upsert_ejs_entry: guide("upsert_ejs_entry", "按 name 局部新增或更新单个 EJS entry。", ["project_id", "name"], { project_id: "project_xxx", name: "角色A_阶段01_初识", role: "stage", content: "..." }, ["validate_ejs_config"]),
  submit_ejs_config: guide("submit_ejs_config", "高级入口：提交完整 EJS config。普通条目修改优先用 upsert_ejs_entry。", ["project_id", "ejs"], { project_id: "project_xxx", ejs: { enabled: true, entries: [] } }, ["validate_ejs_config"]),
  validate_ejs_config: guide("validate_ejs_config", "校验 EJS 配置。", ["project_id"], { project_id: "project_xxx" }, ["build_ejs_entries"]),
  build_ejs_entries: guide("build_ejs_entries", "预览 EJS 将合并的世界书条目。", ["project_id"], { project_id: "project_xxx" }, ["generate_character_card_json"]),
};

function guide(tool: string, purpose: string, required_fields: string[], example_input: unknown, next_tools: string[]): ToolUsageGuide {
  return {
    tool,
    purpose,
    when_to_call: purpose,
    required_fields,
    example_input,
    common_mistakes: ["不要手写完整最终 JSON；优先使用分片草稿或局部 upsert 工具"],
    next_tools,
  };
}

export function getToolUsageGuide(tool: string): ToolUsageGuide | { available_tools: string[]; message: string } {
  return GUIDES[tool] ?? {
    message: `未找到 ${tool} 的专门指南；工作流由随包 skill 文档指导，可先查看 available_tools 并选择具体工具。`,
    available_tools: Object.keys(GUIDES).sort(),
  };
}
