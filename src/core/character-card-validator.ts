import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { validateGreetings } from "./greeting-validator.js";
import { validateWorldbookDraft, type ValidationIssue } from "./worldbook-validator.js";

export interface CharacterCardValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    worldbook_entry_count: number;
    greeting_count: number;
  };
}

export function validateCharacterCardConfig(input: {
  config: CharacterCardConfig;
  draft?: WorldbookDraftEntry[];
  mvuEnabled?: boolean;
}): CharacterCardValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { config, draft } = input;

  if (!config.card.name.trim()) {
    errors.push({ field: "card.name", severity: "error", message: "角色卡 name 必填" });
  }
  if (!config.card.first_mes.trim()) {
    errors.push({ field: "card.first_mes", severity: "error", message: "角色卡 first_mes 必填" });
  }
  if (config.card.description.trim()) {
    warnings.push({ field: "card.description", severity: "warning", message: "当前规范建议 description 为空，角色信息放入世界书条目" });
  }
  if (looksLikeLongSetting(config.card.personality)) {
    warnings.push({ field: "card.personality", severity: "warning", message: "personality 中疑似包含大段人设，当前规范建议移入 character_personality 世界书条目" });
  }
  if (looksLikeLongSetting(config.card.scenario)) {
    warnings.push({ field: "card.scenario", severity: "warning", message: "scenario 中疑似包含大段场景或背景设定，当前规范建议移入世界书条目" });
  }

  const greetingValidation = validateGreetings({ config, mvu_enabled: input.mvuEnabled });
  errors.push(...greetingValidation.errors);
  warnings.push(...greetingValidation.warnings);

  if (config.worldbook.source === "project_draft") {
    if (!draft) {
      errors.push({ field: "worldbook.source", severity: "error", message: "worldbook.source=project_draft 时项目必须有 draft" });
    } else {
      const worldbookValidation = validateWorldbookDraft(draft);
      errors.push(...worldbookValidation.errors.map((issue) => ({ ...issue, field: `worldbook.${issue.field ?? "unknown"}` })));
      warnings.push(...worldbookValidation.warnings.map((issue) => ({ ...issue, field: `worldbook.${issue.field ?? "unknown"}` })));
    }
  } else {
    warnings.push({ field: "worldbook.source", severity: "warning", message: "未嵌入世界书，角色信息可能不足" });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      worldbook_entry_count: config.worldbook.source === "project_draft" ? draft?.length ?? 0 : 0,
      greeting_count: 1 + config.card.alternate_greetings.length,
    },
  };
}

function looksLikeLongSetting(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 120 || /<[^>]+>|角色档案|背景|关系|性格|经历|世界观/.test(trimmed);
}
