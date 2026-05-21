import type { ExtractionResult } from "../schemas/extraction.js";
import type { WorldbookEntryPlan } from "../schemas/worldbook-draft.js";

export type CardType = "single_character" | "multi_character" | "world_only";

export function detectCardType(extraction: ExtractionResult): CardType {
  if (extraction.characters.length === 0) return "world_only";
  if (extraction.characters.length === 1) return "single_character";
  return "multi_character";
}

export function planEntries(extraction: ExtractionResult): { card_type: CardType; entries_plan: WorldbookEntryPlan[] } {
  const cardType = detectCardType(extraction);
  const plan: WorldbookEntryPlan[] = [];

  if (extraction.world.length > 0 || cardType === "world_only") {
    plan.push({
      comment: "世界观总纲",
      entryType: "world_summary",
      position: "before_char",
      order: 1,
      constant: true,
      keys: [],
      reason: "世界框架应常驻，并在角色信息前注入",
    });
  }

  if (cardType === "multi_character") {
    plan.push({
      comment: "角色速览",
      entryType: "character_overview",
      position: "before_char",
      order: 4,
      constant: true,
      keys: [],
      reason: "多角色卡需要常驻速览，避免所有角色详情同时常驻",
    });
  }

  extraction.characters.forEach((character, index) => {
    const keys = [character.name, ...character.aliases].filter(Boolean);
    const isSingle = cardType === "single_character";
    plan.push({
      comment: `${character.name}_基础设定`,
      entryType: "character_basic",
      position: "after_char",
      order: isSingle ? 10 : 10 + index,
      constant: isSingle,
      keys: isSingle ? [] : keys,
      reason: isSingle ? "单角色卡核心角色条目常驻" : "多角色卡角色详情按关键词触发",
    });
    plan.push({
      comment: `${character.name}_性格`,
      entryType: "character_personality",
      position: "after_char",
      order: isSingle ? 30 : 35 + index,
      constant: isSingle,
      keys: isSingle ? [] : keys,
      reason: "性格条目独立，避免和基础设定混杂",
    });
  });

  extraction.items.forEach((item, index) => {
    plan.push({
      comment: `${item.name}_条目`,
      entryType: item.type.includes("ability") ? "ability" : "item",
      position: "after_char",
      order: 50 + index,
      constant: cardType === "world_only",
      keys: cardType === "world_only" ? [] : [item.name],
      reason: cardType === "world_only" ? "纯世界书条目默认常驻" : "物品/能力按关键词触发",
    });
  });

  extraction.events.forEach((event, index) => {
    plan.push({
      comment: `${event.name}_事件`,
      entryType: "event",
      position: "after_char",
      order: 80 + index,
      constant: cardType === "world_only",
      keys: cardType === "world_only" ? [] : [event.name, ...event.participants],
      reason: cardType === "world_only" ? "纯世界书条目默认常驻" : "事件按关键词触发",
    });
  });

  return { card_type: cardType, entries_plan: plan };
}
