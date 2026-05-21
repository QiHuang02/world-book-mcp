import type { SuggestedDecision } from "../schemas/decision.js";
import { classifyWorldbookTask, type TaskClassificationInput, type TaskClassificationResult, type WorldbookTaskClass } from "./task-classifier.js";

export interface ClarificationStageInput {
  request?: string;
  task_type?: WorldbookTaskClass;
  wants_character_card?: boolean;
  wants_mvu?: boolean;
  wants_html?: boolean;
  wants_ejs?: boolean;
  stage?: "intake" | "post_classification";
}

export interface ClarificationResult {
  task_type: WorldbookTaskClass;
  needs_clarification: boolean;
  suggested_decisions: SuggestedDecision[];
  notes: string[];
}

export interface ClassifyWithClarificationResult extends TaskClassificationResult, ClarificationResult {
  recommended_next_tool?: string;
}

const ORIGIN_TYPE_DECISION = (sourceTool?: string): SuggestedDecision => ({
  id: "origin_type",
  question: "请确认这次任务是原创还是二创？",
  options: [
    { value: "original", label: "原创", description: "无原作素材，由用户提供创意" },
    { value: "derivative", label: "二创", description: "基于已有小说/游戏/网页等素材进行改编或提取" },
    { value: "mixed", label: "混合", description: "原创为主，借鉴部分已有素材" },
  ],
  allow_custom: false,
  multiple: false,
  source_tool: sourceTool,
});

const TOGGLE_OPTIONS = [
  { value: "yes", label: "是" },
  { value: "no", label: "否" },
];

export function detectClarificationNeeds(input: ClarificationStageInput): ClarificationResult {
  const classification = classifyWorldbookTask({ request: input.request ?? "", wants_character_card: input.wants_character_card, wants_mvu: input.wants_mvu, wants_html: input.wants_html, wants_ejs: input.wants_ejs });
  const taskType = input.task_type ?? classification.task_type;
  const request = (input.request ?? "").toLowerCase();
  const decisions: SuggestedDecision[] = [];

  if (input.stage !== "post_classification" && needsOriginClarification(taskType, request)) {
    decisions.push(ORIGIN_TYPE_DECISION(taskTypeToTool(taskType)));
  }

  for (const decision of decisionsFor(taskType, input, request)) {
    decisions.push(decision);
  }

  return {
    task_type: taskType,
    needs_clarification: decisions.length > 0,
    suggested_decisions: decisions,
    notes: notesFor(taskType, input, request, decisions.length > 0),
  };
}

export function classifyWorldbookTaskWithClarification(input: TaskClassificationInput): ClassifyWithClarificationResult {
  const classification = classifyWorldbookTask(input);
  const clarification = detectClarificationNeeds({ request: input.request, task_type: classification.task_type, wants_character_card: input.wants_character_card, wants_mvu: input.wants_mvu, wants_html: input.wants_html, wants_ejs: input.wants_ejs, stage: "intake" });
  return {
    ...classification,
    ...clarification,
    recommended_next_tool: clarification.needs_clarification ? "request_user_decision" : recommendedAfterClassify(classification.task_type),
  };
}

function decisionsFor(taskType: WorldbookTaskClass, input: ClarificationStageInput, request: string): SuggestedDecision[] {
  switch (taskType) {
    case "original_character_card":
      return originalCharacterCardDecisions(input, request);
    case "derivative_extraction":
      return derivativeDecisions(input, request);
    case "worldbuilding_only":
      return worldbuildingOnlyDecisions(request);
    case "item_ability_equipment":
      return itemDecisions(request);
    case "style_extraction":
      return styleDecisions(request);
    case "chapter_extraction":
      return chapterDecisions(request);
    case "modify_existing":
      return modifyExistingDecisions(request);
    case "query_existing":
      return [];
    case "mvu_zod":
      return mvuDecisions(input);
    case "ejs_dynamic":
      return ejsDecisions(input);
    case "html_beautify":
      return htmlDecisions(input);
    case "content_lint":
      return contentLintDecisions();
  }
}

function originalCharacterCardDecisions(input: ClarificationStageInput, request: string): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [];
  decisions.push({
    id: "card_type",
    question: "请确认卡型（决定蓝绿灯策略）",
    options: [
      { value: "single_character_card", label: "单角色卡", description: "1 个核心角色，所有拆分条目蓝灯", is_recommended: true },
      { value: "multi_character_card", label: "多角色卡", description: "2+ 核心角色，速览蓝灯/详情绿灯" },
      { value: "worldbook_only", label: "纯世界书", description: "无角色卡承载，由系统/EJS 驱动" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "classify_worldbook_card_type",
  });
  decisions.push({
    id: "worldbuilding_type",
    question: "请确认世界观类型 A/B/C",
    options: [
      { value: "A_realistic_background", label: "A 真实背景", description: "现代/历史现实舞台，只补必要细节" },
      { value: "B_small_world", label: "B 小世界", description: "学校、宅邸、小镇等封闭舞台" },
      { value: "C_large_world", label: "C 大世界", description: "架空大陆、奇幻/科幻文明" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "classify_worldbuilding_type",
  });
  if (input.wants_mvu === undefined && !/\bmvu\b|状态变量|好感度|变量系统/.test(request)) {
    decisions.push(toggleDecision("wants_mvu", "是否启用 MVU/ZOD 变量系统？", "create_mvu_schema_template"));
  }
  if (input.wants_ejs === undefined && !/\bejs\b|多阶段|动态条目|getwi/.test(request)) {
    decisions.push(toggleDecision("wants_ejs", "是否启用 EJS 动态内容？（依赖 MVU）", "create_ejs_template"));
  }
  if (input.wants_html === undefined && !/html|状态栏|美化|前端/.test(request)) {
    decisions.push(toggleDecision("wants_html", "是否启用 HTML 状态栏 / 前端美化？", "create_html_beautify_template"));
  }
  return decisions;
}

function derivativeDecisions(_input: ClarificationStageInput, request: string): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [];
  if (!/小说|游戏|wiki|百科|网页|搜索|文本|资料/.test(request)) {
    decisions.push({
      id: "source_kind",
      question: "请确认素材类型",
      options: [
        { value: "novel", label: "小说" },
        { value: "game", label: "游戏" },
        { value: "wiki", label: "wiki/百科" },
        { value: "web_research", label: "网络搜索摘要" },
        { value: "mixed", label: "多源混合" },
      ],
      allow_custom: false,
      multiple: false,
      source_tool: "create_derivative_extraction_template",
    });
  }
  decisions.push({
    id: "extraction_focus",
    question: "请确认要提取哪些维度",
    options: [
      { value: "characters", label: "角色", is_recommended: true },
      { value: "world", label: "世界观" },
      { value: "items", label: "物品/能力" },
      { value: "events", label: "事件" },
      { value: "style", label: "文风" },
      { value: "chapters", label: "章节" },
    ],
    allow_custom: false,
    multiple: true,
    source_tool: "create_derivative_extraction_template",
  });
  return decisions;
}

function worldbuildingOnlyDecisions(request: string): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [
    {
      id: "worldbuilding_type",
      question: "请确认世界观类型 A/B/C",
      options: [
        { value: "A_realistic_background", label: "A 真实背景" },
        { value: "B_small_world", label: "B 小世界" },
        { value: "C_large_world", label: "C 大世界" },
      ],
      allow_custom: false,
      multiple: false,
      source_tool: "classify_worldbuilding_type",
    },
  ];
  if (!/单角色|多角色|纯世界|系统驱动/.test(request)) {
    decisions.push({
      id: "card_type",
      question: "世界观最终是否要承载角色卡？",
      options: [
        { value: "worldbook_only", label: "纯世界书", is_recommended: true },
        { value: "single_character_card", label: "单角色卡" },
        { value: "multi_character_card", label: "多角色卡" },
      ],
      allow_custom: false,
      multiple: false,
      source_tool: "classify_worldbook_card_type",
    });
  }
  return decisions;
}

function itemDecisions(_request: string): SuggestedDecision[] {
  return [{
    id: "item_kind",
    question: "请确认条目类别（可多选）",
    options: [
      { value: "clothing", label: "服装" },
      { value: "special_item", label: "特殊道具" },
      { value: "weapon", label: "武器" },
      { value: "ability", label: "能力" },
      { value: "equipment", label: "装备" },
      { value: "generic", label: "通用物品" },
    ],
    allow_custom: false,
    multiple: true,
    source_tool: "validate_item_entry",
  }];
}

function styleDecisions(_request: string): SuggestedDecision[] {
  return [
    {
      id: "style_source_kind",
      question: "文风来自原作素材还是用户自创？",
      options: [
        { value: "from_text", label: "原作文本提取" },
        { value: "from_web_research", label: "网页搜索摘要" },
        { value: "user_defined", label: "用户自创规则" },
      ],
      allow_custom: false,
      multiple: false,
      source_tool: "create_style_extraction_template",
    },
    {
      id: "style_purpose",
      question: "文风目的",
      options: [
        { value: "imitate", label: "模仿原作" },
        { value: "new_rules", label: "自创规则" },
        { value: "mixed", label: "模仿 + 补强" },
      ],
      allow_custom: false,
      multiple: false,
      source_tool: "create_style_extraction_template",
    },
  ];
}

function chapterDecisions(_request: string): SuggestedDecision[] {
  return [
    {
      id: "chapter_count_hint",
      question: "请粗略估计章节数量",
      options: [
        { value: "1-3", label: "1-3" },
        { value: "4-10", label: "4-10" },
        { value: "10-30", label: "10-30" },
        { value: "30+", label: "30 以上" },
      ],
      allow_custom: true,
      multiple: false,
      source_tool: "create_chapter_extraction_template",
    },
    toggleDecision("need_line_index", "是否需要为每章标注原文行号？", "submit_derivative_extraction_outline"),
  ];
}

function modifyExistingDecisions(_request: string): SuggestedDecision[] {
  return [
    {
      id: "modification_kind",
      question: "请确认修改类型（可多选）",
      options: [
        { value: "add_entry", label: "新增条目" },
        { value: "update_entry", label: "更新条目" },
        { value: "delete_entry", label: "删除条目" },
        { value: "reorder_entry", label: "调整顺序" },
        { value: "toggle_entry", label: "启用/禁用" },
      ],
      allow_custom: false,
      multiple: true,
      source_tool: "create_worldbook_patch",
    },
    {
      id: "worldbook_path",
      question: "请提供已有世界书 JSON 文件路径（output 下的相对或绝对路径）",
      options: [],
      allow_custom: true,
      multiple: false,
      source_tool: "import_worldbook_json",
    },
  ];
}

function mvuDecisions(input: ClarificationStageInput): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [{
    id: "mvu_character_names",
    question: "请输入需要追踪变量的角色名（用英文逗号分隔）",
    options: [],
    allow_custom: true,
    multiple: false,
    source_tool: "create_mvu_schema_template",
  }];
  if (input.wants_html === undefined) {
    decisions.push(toggleDecision("wants_statusbar", "是否同时配置 HTML 状态栏？", "create_html_beautify_template"));
  }
  return decisions;
}

function ejsDecisions(input: ClarificationStageInput): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [];
  if (!input.wants_mvu) {
    decisions.push(toggleDecision("mvu_already_enabled", "EJS 依赖 MVU，请确认 MVU 是否已经启用？", "validate_mvu_config"));
  }
  decisions.push({
    id: "ejs_template_type",
    question: "请确认 EJS 模板类型",
    options: [
      { value: "phase_profile", label: "阶段人设", is_recommended: true },
      { value: "palette", label: "调色盘" },
      { value: "custom", label: "自定义" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "create_ejs_template",
  });
  return decisions;
}

function htmlDecisions(input: ClarificationStageInput): SuggestedDecision[] {
  const decisions: SuggestedDecision[] = [{
    id: "html_target",
    question: "请确认 HTML 美化目标",
    options: [
      { value: "statusbar", label: "状态栏" },
      { value: "global", label: "全局美化" },
      { value: "both", label: "状态栏 + 全局" },
      { value: "start_picker", label: "开场选择器" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "create_html_beautify_template",
  }];
  if (input.wants_mvu === undefined) {
    decisions.push(toggleDecision("wants_mvu_pairing", "是否需要与 MVU 状态变量联动？", "create_mvu_schema_template"));
  }
  return decisions;
}

function contentLintDecisions(): SuggestedDecision[] {
  return [{
    id: "lint_scope",
    question: "请确认禁词扫描范围",
    options: [
      { value: "single_text", label: "单段文本" },
      { value: "project_all", label: "整个 project 产物", is_recommended: true },
      { value: "single_entry", label: "单条目" },
    ],
    allow_custom: true,
    multiple: false,
    source_tool: "create_writing_optimization_report",
  }];
}

function notesFor(taskType: WorldbookTaskClass, input: ClarificationStageInput, _request: string, hasDecisions: boolean): string[] {
  const notes: string[] = [];
  if (hasDecisions) notes.push("用户描述存在歧义，建议依次调用 request_user_decision 后再继续工作流");
  if (taskType === "ejs_dynamic" && !input.wants_mvu) notes.push("EJS 必须先启用 MVU");
  if (taskType === "html_beautify") notes.push("HTML 美化资产最终需要通过角色卡或独立 regex 脚本承载");
  return notes;
}

function recommendedAfterClassify(taskType: WorldbookTaskClass): string {
  switch (taskType) {
    case "derivative_extraction":
      return "create_derivative_extraction_template";
    case "worldbuilding_only":
    case "original_character_card":
      return "create_worldbuilding_outline";
    case "item_ability_equipment":
      return "validate_item_entry";
    case "style_extraction":
      return "create_style_extraction_template";
    case "chapter_extraction":
      return "create_chapter_extraction_template";
    case "modify_existing":
      return "import_worldbook_json";
    case "query_existing":
      return "query_worldbook";
    case "mvu_zod":
      return "create_mvu_schema_template";
    case "ejs_dynamic":
      return "create_ejs_template";
    case "html_beautify":
      return "create_html_beautify_template";
    case "content_lint":
      return "create_writing_optimization_report";
  }
}

function needsOriginClarification(taskType: WorldbookTaskClass, request: string): boolean {
  if (["mvu_zod", "ejs_dynamic", "html_beautify", "content_lint", "modify_existing", "query_existing"].includes(taskType)) return false;
  if (/原创|原创设定|自创|完全原创/.test(request)) return false;
  if (/二创|同人|原作|提取|根据.*(?:小说|文本|游戏|网页|资料)/.test(request)) return false;
  return true;
}

function taskTypeToTool(taskType: WorldbookTaskClass): string {
  switch (taskType) {
    case "original_character_card":
      return "classify_worldbook_card_type";
    case "derivative_extraction":
      return "create_derivative_extraction_template";
    case "worldbuilding_only":
      return "classify_worldbuilding_type";
    case "style_extraction":
      return "create_style_extraction_template";
    case "chapter_extraction":
      return "create_chapter_extraction_template";
    case "item_ability_equipment":
      return "validate_item_entry";
    default:
      return "classify_worldbook_task";
  }
}

function toggleDecision(id: string, question: string, sourceTool: string): SuggestedDecision {
  return {
    id,
    question,
    options: TOGGLE_OPTIONS,
    allow_custom: false,
    multiple: false,
    source_tool: sourceTool,
  };
}

export function buildCardTypeDecision(): SuggestedDecision {
  return {
    id: "card_type",
    question: "请确认卡型（决定蓝绿灯策略）",
    options: [
      { value: "single_character_card", label: "单角色卡", description: "1 个核心角色，所有拆分条目蓝灯", is_recommended: true },
      { value: "multi_character_card", label: "多角色卡", description: "2+ 核心角色，速览蓝灯/详情绿灯" },
      { value: "worldbook_only", label: "纯世界书", description: "无角色卡承载，由系统/EJS 驱动" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "classify_worldbook_card_type",
  };
}

export function buildWorldbuildingTypeDecision(): SuggestedDecision {
  return {
    id: "worldbuilding_type",
    question: "请确认世界观类型 A/B/C",
    options: [
      { value: "A_realistic_background", label: "A 真实背景", description: "现代/历史现实舞台，只补必要细节" },
      { value: "B_small_world", label: "B 小世界", description: "学校、宅邸、小镇等封闭舞台" },
      { value: "C_large_world", label: "C 大世界", description: "架空大陆、奇幻/科幻文明" },
    ],
    allow_custom: false,
    multiple: false,
    source_tool: "classify_worldbuilding_type",
  };
}
