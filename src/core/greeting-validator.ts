import type { CharacterCardConfig } from "../schemas/character-card.js";
import { validateFirstMessages } from "./first-message-validator.js";

export function validateGreetings(input: { config: CharacterCardConfig; mvu_enabled?: boolean }) {
  const result = validateFirstMessages({ config: input.config, mvu_enabled: input.mvu_enabled });
  if (!input.mvu_enabled) return result;
  const placeholderErrors = result.errors.filter((item) => item.code === "first_mes.missing_status_placeholder");
  if (placeholderErrors.length === 0) return result;
  const errors = result.errors.filter((item) => item.code !== "first_mes.missing_status_placeholder");
  const warnings = [...result.warnings, ...placeholderErrors.map((item) => ({ ...item, severity: "warning" as const }))];
  return { ...result, ok: errors.length === 0, valid: errors.length === 0, errors, warnings };
}

export type GreetingValidationResult = ReturnType<typeof validateGreetings>;
