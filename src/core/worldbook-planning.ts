import type { EntryType, PositionName, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export type SkillCardType = "single_character_card" | "multi_character_card" | "worldbook_only";

export interface WorldbookEntryPlan {
  comment: string;
  entryType: EntryType;
  position: PositionName;
  order: number;
  constant: boolean;
  keys: string[];
  reason: string;
}

export interface WorldbookPlanInput {
  card_type: SkillCardType;
  characters?: Array<{ name: string; aliases?: string[] }>;
  world_sections?: string[];
  items?: string[];
  scenes?: string[];
  events?: string[];
  include_style_entries?: boolean;
  include_chapter_entries?: boolean;
}

export function classifyWorldbookCardType(input: { core_character_count: number; has_character_card?: boolean; is_system_driven?: boolean }): { card_type: SkillCardType; reason: string; strategy: string[] } {
  if (input.is_system_driven || !input.has_character_card) {
    return { card_type: "worldbook_only", reason: "无角色卡承载或系统驱动世界书", strategy: ["条目默认蓝灯", "动态变化交给 EJS 或后续逻辑"] };
  }
  if (input.core_character_count <= 1) {
    return { card_type: "single_character_card", reason: "只有 1 个核心角色", strategy: ["核心角色拆分条目全部蓝灯", "NPC/场景/物品按关键词绿灯"] };
  }
  return { card_type: "multi_character_card", reason: "存在 2 个及以上核心角色", strategy: ["角色速览蓝灯", "角色详情/性格绿灯 + keys + scanDepth=2"] };
}

export function createWorldbookEntryPlan(input: WorldbookPlanInput): { card_type: SkillCardType; entries_plan: WorldbookEntryPlan[] } {
  const plan: WorldbookEntryPlan[] = [];
  const worldSections = input.world_sections?.length ? input.world_sections : ["世界观总纲"];
  worldSections.forEach((name, index) => {
    plan.push(planItem(name, index === 0 ? "world_summary" : "background", "before_char", index + 1, true, [], "世界观/背景信息应常驻并位于角色定义之前"));
  });

  const characters = input.characters ?? [];
  if (input.card_type === "multi_character_card" && characters.length > 0) {
    plan.push(planItem("角色速览", "character_overview", "before_char", 4, true, [], "多角色卡需要常驻速览，避免全部详情常驻"));
  }

  characters.forEach((character, index) => {
    const keys = [character.name, ...(character.aliases ?? [])].filter(Boolean);
    const constant = input.card_type === "single_character_card" || input.card_type === "worldbook_only";
    plan.push(planItem(`${character.name}_基础设定`, "character_basic", "after_char", input.card_type === "single_character_card" ? 10 : 10 + index, constant, constant ? [] : keys, constant ? "单角色/纯世界书角色信息常驻" : "多角色详情按关键词触发"));
    plan.push(planItem(`${character.name}_性格`, "character_personality", "after_char", input.card_type === "single_character_card" ? 30 : 35 + index, constant, constant ? [] : keys, "性格必须独立条目"));
  });

  (input.items ?? []).forEach((name, index) => plan.push(planItem(`${name}_物品`, "item", "after_char", 50 + index, input.card_type === "worldbook_only", input.card_type === "worldbook_only" ? [] : [name], "物品/装备按关键词触发")));
  (input.scenes ?? []).forEach((name, index) => plan.push(planItem(`${name}_场景`, "scene", "after_char", 80 + index, input.card_type === "worldbook_only", input.card_type === "worldbook_only" ? [] : [name], "场景按关键词触发")));
  (input.events ?? []).forEach((name, index) => plan.push(planItem(`${name}_事件`, "event", "after_char", 90 + index, input.card_type === "worldbook_only", input.card_type === "worldbook_only" ? [] : [name], "事件按关键词触发")));

  if (input.include_style_entries) {
    plan.push(planItem("文风规则", "other", "before_an", 1, true, [], "文风规则注入作者注之前"));
  }
  if (input.include_chapter_entries) {
    plan.push(planItem("章节摘要模板", "event", "after_char", 100, false, ["章节", "剧情"], "章节摘要绿灯触发，scanDepth=2"));
  }

  return { card_type: input.card_type, entries_plan: plan };
}

export function validateWorldbookEntryPlan(input: { card_type: SkillCardType; plan: WorldbookEntryPlan[] }): { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; summary: { entry_count: number } } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const hasWorldSummary = input.plan.some((entry) => entry.entryType === "world_summary" && entry.order === 1);
  if (!hasWorldSummary) warnings.push({ field: "plan", severity: "warning", message: "建议包含 order=1 的世界观总纲" });

  input.plan.forEach((entry) => {
    if (!entry.constant && entry.keys.length === 0) errors.push({ entry: entry.comment, field: "keys", severity: "error", message: "绿灯规划必须提供 keys" });
    if (["before_an", "after_an", "before_em", "after_em", "outlet"].includes(entry.position) && entry.entryType !== "other") warnings.push({ entry: entry.comment, field: "position", severity: "warning", message: "普通世界书条目不建议使用该 position" });
    if (input.card_type === "single_character_card" && ["character_basic", "character_personality"].includes(entry.entryType) && !entry.constant) errors.push({ entry: entry.comment, field: "constant", severity: "error", message: "单角色卡核心角色条目必须蓝灯" });
    if (input.card_type === "multi_character_card" && ["character_basic", "character_personality"].includes(entry.entryType) && entry.constant) warnings.push({ entry: entry.comment, field: "constant", severity: "warning", message: "多角色卡详情条目建议绿灯，角色速览才蓝灯" });
    if (input.card_type === "worldbook_only" && !entry.constant) warnings.push({ entry: entry.comment, field: "constant", severity: "warning", message: "纯世界书条目默认建议蓝灯，动态变化交给 EJS" });
  });

  return { valid: errors.length === 0, errors, warnings, summary: { entry_count: input.plan.length } };
}

export function validateDraftAgainstCardType(entries: WorldbookDraftEntry[], cardType?: SkillCardType): ValidationIssue[] {
  if (!cardType) return [];
  const issues: ValidationIssue[] = [];
  entries.forEach((entry) => {
    if (cardType === "single_character_card" && ["character_basic", "character_personality"].includes(entry.entryType) && !entry.constant) issues.push({ entry: entry.comment, field: "constant", severity: "error", message: "单角色卡核心角色条目必须为蓝灯 constant=true" });
    if (cardType === "multi_character_card" && ["character_basic", "character_personality"].includes(entry.entryType) && entry.constant) issues.push({ entry: entry.comment, field: "constant", severity: "warning", message: "多角色卡角色详情建议为绿灯 constant=false" });
    if (!entry.constant && entry.scanDepth !== 2) issues.push({ entry: entry.comment, field: "scanDepth", severity: "warning", message: "绿灯条目建议 scanDepth=2" });
  });
  return issues;
}

function planItem(comment: string, entryType: EntryType, position: PositionName, order: number, constant: boolean, keys: string[], reason: string): WorldbookEntryPlan {
  return { comment, entryType, position, order, constant, keys, reason };
}
