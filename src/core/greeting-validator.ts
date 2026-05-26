import type { CharacterCardConfig } from "../schemas/character-card.js";

export interface GreetingValidationIssue { field: string; message: string; severity: "warning" | "error" | "info" }

export function validateGreetings(input: { config: CharacterCardConfig; mvu_enabled?: boolean }): { ok: boolean; warnings: GreetingValidationIssue[]; errors: GreetingValidationIssue[] } {
  const warnings: GreetingValidationIssue[] = [];
  const messages = [input.config.card.first_mes, ...input.config.card.alternate_greetings];
  for (const [index, message] of messages.entries()) {
    const field = index === 0 ? "first_mes" : `alternate_greetings.${index - 1}`;
    if (/你.*(醒来|只好|点头|跟着|决定|选择|走向)/.test(message)) {
      warnings.push({ field, severity: "warning", message: "开场白疑似预设 user 行动或后续行动" });
    }
    if (/你只好|你决定|你选择/.test(message)) {
      warnings.push({ field, severity: "warning", message: "开场白不应预设 user 的后续行动" });
    }
  }
  if (input.mvu_enabled && !messages.some((message) => message.includes("StatusPlaceHolderImpl"))) {
    warnings.push({ field: "first_mes", severity: "warning", message: "启用 MVU 时建议包含 StatusPlaceHolderImpl 占位符" });
  }
  return { ok: true, warnings, errors: [] };
}
