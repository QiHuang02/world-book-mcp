export type WorldbookCardType = "single_character_card" | "multi_character_card" | "worldbook";

export function classifyWorldbookCardType(input: { core_character_count?: number; has_character_card?: boolean }): { card_type: WorldbookCardType; confidence: "low" | "medium" | "high" } {
  if (input.has_character_card && (input.core_character_count ?? 0) <= 1) return { card_type: "single_character_card", confidence: "high" };
  if ((input.core_character_count ?? 0) > 1) return { card_type: "multi_character_card", confidence: "high" };
  return { card_type: "worldbook", confidence: "medium" };
}

export function createWorldbookEntryPlan(input: { card_type: WorldbookCardType; characters?: Array<{ name: string }> }): { entries_plan: Array<{ comment: string; entryType: string; position: string; order: number; constant: boolean; keys: string[]; reason: string }> } {
  const entries = (input.characters ?? []).flatMap((character, index) => [
    { comment: `${character.name}_基础设定`, entryType: "character_basic", position: "before_char", order: 100 + index * 10, constant: input.card_type === "single_character_card", keys: input.card_type === "multi_character_card" ? [character.name] : [], reason: "角色基础信息" },
    { comment: `${character.name}_性格`, entryType: "character_personality", position: "before_char", order: 101 + index * 10, constant: input.card_type === "single_character_card", keys: input.card_type === "multi_character_card" ? [character.name] : [], reason: "角色性格信息" },
  ]);
  return { entries_plan: entries };
}

export function validateWorldbookEntryPlan(input: { card_type: WorldbookCardType; plan: Array<{ comment: string; constant: boolean; keys?: string[] }> }): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  for (const entry of input.plan) {
    if (!entry.constant && (!entry.keys || entry.keys.length === 0)) errors.push(`${entry.comment} 是关键词条目但缺少 keys`);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
