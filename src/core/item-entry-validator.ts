import type { ValidationIssue } from "./worldbook-validator.js";

export type ItemKind = "clothing" | "special_item" | "weapon" | "ability" | "equipment" | "generic";

export function validateItemEntry(input: { content: string; item_kind: ItemKind }): { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const content = input.content;

  if (!/^\s*<([a-zA-Z_][\w-]*)>[\s\S]*<\/\1>\s*$/.test(content)) warnings.push({ field: "content", severity: "warning", message: "物品/能力条目建议使用 XML 包裹 YAML" });

  if (input.item_kind === "clothing") {
    if (/优点|缺点|舒适|显瘦|耐洗|不耐洗|穿着感|手感/.test(content)) warnings.push({ field: "content", severity: "warning", message: "服装条目只写外观、材质、剪裁、颜色，不写优缺点或穿着感受" });
  }
  if (input.item_kind === "special_item") {
    if (/\d+(?:\.\d+)?\s*(?:厘米|cm|CM|毫米|mm|MM)/.test(content)) warnings.push({ field: "content", severity: "warning", message: "特殊道具不建议写精确长度/直径尺寸，改写外形和玩法结构" });
  }
  if (input.item_kind === "weapon") {
    if (/威力巨大|精准度极高|最爱|无坚不摧|毁天灭地|强大/.test(content)) warnings.push({ field: "content", severity: "warning", message: "武器条目不要写评测式夸赞，写类型、弹种、结构和实际用途" });
  }
  if (input.item_kind === "ability") {
    if (/强大|无敌|无所不能|威力巨大/.test(content)) warnings.push({ field: "content", severity: "warning", message: "能力条目应写具体效果、限制和代价，不写空泛强度标签" });
    if (!/限制|代价|limits|effects|效果/.test(content)) warnings.push({ field: "content", severity: "warning", message: "能力条目建议包含 effects 与 limits/代价" });
  }

  return { valid: errors.length === 0, errors, warnings };
}
