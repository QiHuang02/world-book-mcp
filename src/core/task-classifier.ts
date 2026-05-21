import type { WorkflowTaskType } from "./workflow.js";

export type WorldbookTaskClass =
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

export interface TaskClassificationInput {
  request: string;
  wants_character_card?: boolean;
  wants_mvu?: boolean;
  wants_html?: boolean;
  wants_ejs?: boolean;
}

export interface TaskClassificationResult {
  task_type: WorldbookTaskClass;
  original_or_derivative: "original" | "derivative" | "existing_asset" | "technical" | "unknown";
  required_workflow: WorkflowTaskType;
  required_guides: string[];
  notes: string[];
}

const GUIDE_MAP: Record<WorldbookTaskClass, string[]> = {
  original_character_card: ["guide.md", "character-card-guide.md", "character-guide.md", "world-book-guide.md", "writing-optimization-guide.md"],
  derivative_extraction: ["guide.md", "information-extraction-guide.md", "world-book-guide.md", "writing-optimization-guide.md"],
  worldbuilding_only: ["guide.md", "world-building-guide.md", "world-book-guide.md", "writing-optimization-guide.md"],
  item_ability_equipment: ["guide.md", "world-book-guide.md", "config-guide.md", "writing-optimization-guide.md"],
  style_extraction: ["guide.md", "information-extraction-guide.md", "writing-optimization-guide.md"],
  chapter_extraction: ["guide.md", "information-extraction-guide.md", "world-book-guide.md"],
  modify_existing: ["guide.md", "world-book-guide.md", "config-guide.md"],
  query_existing: ["guide.md", "world-book-guide.md"],
  mvu_zod: ["guide.md", "mvu-guide.md", "character-card-guide.md"],
  ejs_dynamic: ["guide.md", "ejs-guide.md", "mvu-guide.md"],
  html_beautify: ["guide.md", "html-beautify-guide.md", "character-card-guide.md"],
  content_lint: ["guide.md", "writing-optimization-guide.md"],
};

export function classifyWorldbookTask(input: TaskClassificationInput): TaskClassificationResult {
  const request = input.request.toLowerCase();
  const task_type = detectTaskType(input.request, request, input);
  const required_workflow = workflowFor(task_type, request);
  return {
    task_type,
    original_or_derivative: originFor(task_type, request),
    required_workflow,
    required_guides: GUIDE_MAP[task_type],
    notes: notesFor(task_type, input),
  };
}

function detectTaskType(raw: string, request: string, input: TaskClassificationInput): WorldbookTaskClass {
  if (input.wants_ejs || /\bejs\b|动态条目|阶段条目|getwi|getvar/.test(request)) return "ejs_dynamic";
  if (input.wants_html || /html|美化|状态栏|前端|css|正则脚本/.test(request)) return "html_beautify";
  if (input.wants_mvu || /\bmvu\b|zod|变量|状态变量|initvar|状态栏占位符/.test(request)) return "mvu_zod";
  if (/禁词|润色|优化|扫描|自查|lint|违禁词/.test(request)) return "content_lint";
  if (/修改|更新|patch|补丁|删除条目|添加条目|已有世界书|导入世界书/.test(request)) return "modify_existing";
  if (/查询|查看|搜索|统计|brief|uid/.test(request)) return "query_existing";
  if (/文风|风格提取|行文|叙事风格/.test(request)) return "style_extraction";
  if (/章节|章回|剧情提取|故事提取|剧情总结/.test(request)) return "chapter_extraction";
  if (/物品|道具|装备|服装|衣服|能力|技能|法术|武器/.test(request)) return "item_ability_equipment";
  if (/世界观|世界设定|世界书|势力|地理|历史|社会结构/.test(request) && /原创|设计|创建|生成|设定/.test(request)) return "worldbuilding_only";
  if (/二创|原作|同人|提取|根据.*(?:文本|资料|网页|小说|作品)|从.*(?:文本|资料|网页|小说|作品)/.test(raw)) return "derivative_extraction";
  return input.wants_character_card || /角色卡|character card|开场白|first_mes|alternate/.test(request) ? "original_character_card" : "worldbuilding_only";
}

function workflowFor(taskType: WorldbookTaskClass, request: string): WorkflowTaskType {
  switch (taskType) {
    case "derivative_extraction":
      return /网页|网址|web|搜索|research/.test(request) ? "from_web_research" : "from_text";
    case "modify_existing":
      return "modify_existing";
    case "query_existing":
      return "query_existing";
    case "content_lint":
      return "content_lint";
    case "mvu_zod":
      return "mvu_zod";
    case "ejs_dynamic":
      return "ejs_dynamic";
    case "html_beautify":
      return "html_beautify";
    case "style_extraction":
      return "style_extraction";
    case "chapter_extraction":
      return "chapter_extraction";
    case "item_ability_equipment":
      return "item_ability_equipment";
    case "worldbuilding_only":
      return "worldbuilding_only";
    case "original_character_card":
      return "original_character_card";
  }
}

function originFor(taskType: WorldbookTaskClass, request: string): TaskClassificationResult["original_or_derivative"] {
  if (["mvu_zod", "ejs_dynamic", "html_beautify", "content_lint"].includes(taskType)) return "technical";
  if (["modify_existing", "query_existing"].includes(taskType)) return "existing_asset";
  if (taskType === "derivative_extraction" || /二创|同人|原作|提取/.test(request)) return "derivative";
  if (taskType === "style_extraction" || taskType === "chapter_extraction") return "derivative";
  if (taskType === "original_character_card" || taskType === "worldbuilding_only" || taskType === "item_ability_equipment") return "original";
  return "unknown";
}

function notesFor(taskType: WorldbookTaskClass, input: TaskClassificationInput): string[] {
  const notes: string[] = [];
  if (taskType === "ejs_dynamic") notes.push("EJS 依赖 MVU，建议先完成 mvu_zod 工作流");
  if (taskType === "html_beautify") notes.push("HTML 美化通常需要角色卡承载 regex / 状态栏资产");
  if (taskType === "original_character_card") notes.push("角色设定应写入世界书条目，角色卡 description 建议留空");
  if (taskType === "worldbuilding_only") notes.push("先产出世界观总纲，再拆分为世界书条目");
  if (input.wants_ejs && !input.wants_mvu) notes.push("用户要求 EJS 但未声明 MVU：应补充 MVU 变量设计");
  return notes;
}
