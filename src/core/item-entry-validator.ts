export interface ItemValidationIssue { field: string; message: string; severity: "warning" | "error" | "info" }

export function validateItemEntry(input: { item_kind: "clothing" | "special_item" | "ability" | string; content: string }): { valid: boolean; warnings: ItemValidationIssue[]; errors: ItemValidationIssue[] } {
  const warnings: ItemValidationIssue[] = [];
  if (input.item_kind === "clothing" && /优点|缺点|显瘦|性感/.test(input.content)) warnings.push({ field: "content", severity: "warning", message: "服装条目应描述客观外观与材质，避免优缺点式评价" });
  if (input.item_kind === "special_item" && /\d+\s*(厘米|cm|CM)/.test(input.content)) warnings.push({ field: "content", severity: "warning", message: "特殊物品避免过度精确尺寸，除非剧情必要" });
  if (input.item_kind === "ability" && /强大|无敌|最强|万能/.test(input.content)) warnings.push({ field: "content", severity: "warning", message: "能力强度描述过于泛化，建议补充限制与代价" });
  return { valid: true, warnings, errors: [] };
}
