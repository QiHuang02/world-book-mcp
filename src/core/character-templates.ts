export function createCharacterBasicEntryTemplate(input: { character_name: string }): { template: string } {
  return { template: `<character>\nname: ${input.character_name}\nappearance: \nidentity: \n</character>` };
}

export function createCharacterPersonalityEntryTemplate(input: { character_name: string }): { template: string } {
  return { template: `<personality>\nname: ${input.character_name}\ntraits: []\nvoice: \n</personality>` };
}

export function validateCharacterEntryStructure(input: { kind: "basic" | "personality"; content: string }): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  if (input.kind === "basic" && /personality\s*:/i.test(input.content)) errors.push("basic 条目不应混入 personality 字段");
  if (input.kind === "personality" && /appearance\s*:/i.test(input.content)) errors.push("personality 条目不应混入 appearance 字段");
  return { valid: errors.length === 0, errors, warnings: [] };
}
