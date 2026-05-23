import { z } from "zod";
import { EntryTypeSchema, PositionNameSchema, type CreateWorldbookDraftTemplateInput, type WorldbookDraftEntry, type WorldbookDraftField } from "../schemas/worldbook-draft.js";
import { validateWorldbookDraft, type ValidationIssue } from "./worldbook-validator.js";

export interface DraftCompletenessIssue {
  comment?: string;
  field: string;
  message: string;
}

export interface DraftNextAction {
  tool: "create_worldbook_draft_entry" | "update_worldbook_draft_field";
  comment?: string;
  field?: WorldbookDraftField;
}

export interface WorldbookDraftCompletenessResult {
  ok: boolean;
  ready_to_merge: boolean;
  entry_count: number;
  missing_fields: DraftCompletenessIssue[];
  next_actions: DraftNextAction[];
  validation: ReturnType<typeof validateWorldbookDraft>;
}

const FieldValueSchemas = {
  comment: z.string().min(1),
  entry_type: EntryTypeSchema,
  keys: z.array(z.string()),
  secondary_keys: z.array(z.string()),
  content: z.string(),
  character_name: z.string().nullable(),
  constant: z.boolean(),
  position: PositionNameSchema,
  order: z.number(),
  enabled: z.boolean(),
  depth: z.number().int().min(0).nullable(),
  scan_depth: z.number().int().min(0).nullable(),
} satisfies Record<WorldbookDraftField, z.ZodTypeAny>;

export function createWorldbookDraftTemplate(input: CreateWorldbookDraftTemplateInput): WorldbookDraftEntry {
  const comment = input.comment.trim();
  const entryType = input.entryType ?? input.entry_type ?? "other";
  const characterName = input.characterName ?? input.character_name;
  const keySeed = characterName?.trim() || comment;
  const constant = input.constant ?? true;
  const scanDepth = input.scanDepth ?? input.scan_depth ?? (!constant ? 2 : undefined);
  return {
    comment,
    entryType,
    keys: uniqueStrings([keySeed]),
    secondaryKeys: [],
    content: "",
    ...(characterName?.trim() ? { characterName: characterName.trim() } : {}),
    constant,
    position: input.position ?? "before_char",
    order: input.order ?? defaultOrderForEntryType(entryType),
    enabled: input.enabled ?? true,
    ...(scanDepth === null || scanDepth === undefined ? {} : { scanDepth }),
    preventRecursion: true,
    excludeRecursion: true,
  };
}

export function updateWorldbookDraftField(entry: WorldbookDraftEntry, field: WorldbookDraftField, value: unknown): WorldbookDraftEntry {
  const next: WorldbookDraftEntry = cloneEntry(entry);

  switch (field) {
    case "comment": {
      next.comment = FieldValueSchemas.comment.parse(value).trim();
      break;
    }
    case "entry_type": {
      next.entryType = FieldValueSchemas.entry_type.parse(value);
      break;
    }
    case "keys": {
      next.keys = uniqueStrings(FieldValueSchemas.keys.parse(value));
      break;
    }
    case "secondary_keys": {
      next.secondaryKeys = uniqueStrings(FieldValueSchemas.secondary_keys.parse(value));
      break;
    }
    case "content": {
      next.content = FieldValueSchemas.content.parse(value);
      break;
    }
    case "character_name": {
      const parsed = FieldValueSchemas.character_name.parse(value);
      if (parsed === null || parsed.trim() === "") delete next.characterName;
      else next.characterName = parsed.trim();
      break;
    }
    case "constant": {
      next.constant = FieldValueSchemas.constant.parse(value);
      break;
    }
    case "position": {
      next.position = FieldValueSchemas.position.parse(value);
      break;
    }
    case "order": {
      next.order = FieldValueSchemas.order.parse(value);
      break;
    }
    case "enabled": {
      next.enabled = FieldValueSchemas.enabled.parse(value);
      break;
    }
    case "depth": {
      const parsed = FieldValueSchemas.depth.parse(value);
      if (parsed === null) delete next.depth;
      else next.depth = parsed;
      break;
    }
    case "scan_depth": {
      const parsed = FieldValueSchemas.scan_depth.parse(value);
      if (parsed === null) delete next.scanDepth;
      else next.scanDepth = parsed;
      break;
    }
  }

  return next;
}

export function updateWorldbookDraftFields(entry: WorldbookDraftEntry, changes: Partial<Record<WorldbookDraftField, unknown>>): WorldbookDraftEntry {
  let next = entry;
  for (const field of Object.keys(changes) as WorldbookDraftField[]) {
    next = updateWorldbookDraftField(next, field, changes[field]);
  }
  return next;
}

export function confirmWorldbookDraftComplete(entries: WorldbookDraftEntry[] | undefined): WorldbookDraftCompletenessResult {
  const draft = entries ?? [];
  const missing: DraftCompletenessIssue[] = [];
  const nextActions: DraftNextAction[] = [];

  if (draft.length === 0) {
    missing.push({ field: "draft", message: "尚未创建任何 .worldbook/draft/*.json 切片模板" });
    nextActions.push({ tool: "create_worldbook_draft_entry" });
  }

  const seen = new Set<string>();
  for (const entry of draft) {
    if (!entry.comment.trim()) {
      missing.push({ comment: entry.comment, field: "comment", message: "comment 不能为空" });
      nextActions.push({ tool: "update_worldbook_draft_field", comment: entry.comment, field: "comment" });
    } else if (seen.has(entry.comment)) {
      missing.push({ comment: entry.comment, field: "comment", message: `comment 重复：${entry.comment}` });
    }
    seen.add(entry.comment);

    if (!entry.content.trim()) {
      missing.push({ comment: entry.comment, field: "content", message: "content 为空，不能合并导出" });
      nextActions.push({ tool: "update_worldbook_draft_field", comment: entry.comment, field: "content" });
    }
    if (!entry.constant && entry.keys.length === 0) {
      missing.push({ comment: entry.comment, field: "keys", message: "constant=false 的绿灯条目必须有 keys" });
      nextActions.push({ tool: "update_worldbook_draft_field", comment: entry.comment, field: "keys" });
    }
    if ((entry.entryType === "character_basic" || entry.entryType === "character_personality") && !entry.characterName?.trim() && !inferCharacterNameFromComment(entry.comment)) {
      missing.push({ comment: entry.comment, field: "character_name", message: "角色类条目建议填写 character_name，或使用“角色名-基础设定/性格”格式的 comment" });
      nextActions.push({ tool: "update_worldbook_draft_field", comment: entry.comment, field: "character_name" });
    }
  }

  const validation = validateWorldbookDraft(draft);
  const missingKeys = new Set(missing.map(missingIssueKey));
  for (const issue of [...validation.errors, ...validation.warnings].filter((issue) => issue.severity === "error") as ValidationIssue[]) {
    const completenessIssue = { comment: issue.entry, field: issue.field ?? "validation", message: issue.message };
    const key = missingIssueKey(completenessIssue);
    if (missingKeys.has(key) || isCoveredByCompletenessChecks(completenessIssue)) continue;
    missingKeys.add(key);
    missing.push(completenessIssue);
  }

  const ready = missing.length === 0 && validation.valid;
  return {
    ok: ready,
    ready_to_merge: ready,
    entry_count: draft.length,
    missing_fields: missing,
    next_actions: dedupeNextActions(nextActions),
    validation,
  };
}

function defaultOrderForEntryType(entryType: WorldbookDraftEntry["entryType"]): number {
  switch (entryType) {
    case "world_summary":
      return 1;
    case "background":
      return 2;
    case "character_overview":
      return 4;
    case "character_basic":
      return 30;
    case "character_personality":
      return 31;
    case "faction":
      return 40;
    case "item":
    case "ability":
      return 50;
    case "scene":
    case "event":
      return 60;
    case "npc":
      return 70;
    case "other":
    default:
      return 100;
  }
}

function inferCharacterNameFromComment(comment: string): string | undefined {
  const match = comment.match(/^(.+?)[-_](基础设定|基础|性格设定|性格|人格)$/);
  return match?.[1]?.trim() || undefined;
}

function cloneEntry(entry: WorldbookDraftEntry): WorldbookDraftEntry {
  return {
    ...entry,
    keys: [...entry.keys],
    secondaryKeys: [...entry.secondaryKeys],
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dedupeNextActions(actions: DraftNextAction[]): DraftNextAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.tool}:${action.comment ?? ""}:${action.field ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function missingIssueKey(issue: DraftCompletenessIssue): string {
  return `${issue.comment ?? ""}:${issue.field}`;
}

function isCoveredByCompletenessChecks(issue: DraftCompletenessIssue): boolean {
  if (issue.field === "entries") return true;
  return ["comment", "content", "keys", "character_name"].includes(issue.field);
}
