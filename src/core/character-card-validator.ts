import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { validateFirstMessages } from "./first-message-validator.js";
import { validateWorldbookDraft } from "./worldbook-validator.js";
import { issue, normalizeIssue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type CharacterCardValidationResult = ValidationSection<{
  worldbook_entry_count: number;
  greeting_count: number;
  description_empty: boolean;
}> & { valid: boolean };

export function validateCharacterCardConfig(input: {
  config: CharacterCardConfig;
  draft?: WorldbookDraftEntry[];
  mvuEnabled?: boolean;
  htmlStatusbarEnabled?: boolean;
}): CharacterCardValidationResult {
  const issues: ValidationIssue[] = [];
  const { config, draft } = input;

  if (!config.card.name.trim()) issues.push(issue({ code: "character_card.name.empty", field: "card.name", severity: "error", message: "角色卡 name 必填" }));
  if (!config.card.first_mes.trim()) issues.push(issue({ code: "character_card.first_mes.empty", field: "card.first_mes", severity: "error", message: "角色卡 first_mes 必填" }));
  if (config.card.description.trim()) {
    const severity = (!draft || draft.length === 0) && looksLikeLongSetting(config.card.description) ? "error" : "warning";
    issues.push(issue({ code: "character_card.description.not_empty", field: "card.description", severity, message: severity === "error" ? "description 内含大段人设且项目 draft 为空，违背新主线；请迁移到世界书条目" : "当前规范建议 description 为空，角色信息放入世界书条目" }));
  }
  if (looksLikeLongSetting(config.card.personality)) issues.push(issue({ code: "character_card.personality.long_setting", field: "card.personality", severity: "warning", message: "personality 中疑似包含大段人设，当前规范建议移入 character_personality 世界书条目" }));
  if (looksLikeLongSetting(config.card.scenario)) issues.push(issue({ code: "character_card.scenario.long_setting", field: "card.scenario", severity: "warning", message: "scenario 中疑似包含大段场景或背景设定，当前规范建议移入世界书条目" }));

  const firstMessage = validateFirstMessages({ config, mvu_enabled: input.mvuEnabled, html_statusbar_enabled: input.htmlStatusbarEnabled });
  issues.push(...firstMessage.errors, ...firstMessage.warnings, ...firstMessage.infos);

  if (config.worldbook.source === "project_draft") {
    if (!draft) issues.push(issue({ code: "character_card.worldbook.missing_draft", field: "worldbook.source", severity: "error", message: "worldbook.source=project_draft 时项目必须有 draft" }));
    else {
      const worldbookValidation = validateWorldbookDraft(draft);
      issues.push(...worldbookValidation.errors.map((item) => normalizeIssue({ ...item, field: `worldbook.${item.field ?? "unknown"}` })));
      issues.push(...worldbookValidation.warnings.map((item) => normalizeIssue({ ...item, field: `worldbook.${item.field ?? "unknown"}` })));
    }
  } else {
    issues.push(issue({ code: "character_card.worldbook.not_embedded", field: "worldbook.source", severity: "warning", message: "未嵌入世界书，角色信息可能不足" }));
  }

  return withValid(section({ ...splitIssues(issues), summary: { worldbook_entry_count: config.worldbook.source === "project_draft" ? draft?.length ?? 0 : 0, greeting_count: 1 + config.card.alternate_greetings.length, description_empty: !config.card.description.trim() } }));
}

function looksLikeLongSetting(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 120 || /<[^>]+>|角色档案|背景|关系|性格|经历|世界观/.test(trimmed);
}
