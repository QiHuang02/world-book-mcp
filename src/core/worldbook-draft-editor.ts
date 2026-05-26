import type { CreateWorldbookDraftTemplateInput, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { WorldbookDraftEntrySchema } from "../schemas/worldbook-draft.js";
import { uniqueStrings } from "../utils/strings.js";
import { updateDraftSliceField, updateDraftSliceFields } from "./draft-field-editor.js";
import { defaultOrderForEntryType } from "./worldbook-entry-defaults.js";
import { validateWorldbookDraft } from "./worldbook-validator.js";

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

export function updateWorldbookDraftField(entry: WorldbookDraftEntry, fieldPath: string, value: unknown): WorldbookDraftEntry {
  const slice = {
    id: entry.comment || "entry",
    type: "entry" as const,
    enabled: true,
    data: entry,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    revision: 0,
  };
  return WorldbookDraftEntrySchema.parse(updateDraftSliceField(slice, fieldPath, value).data);
}

export function updateWorldbookDraftFields(entry: WorldbookDraftEntry, changes: Record<string, unknown>): WorldbookDraftEntry {
  const slice = {
    id: entry.comment || "entry",
    type: "entry" as const,
    enabled: true,
    data: entry,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    revision: 0,
  };
  return WorldbookDraftEntrySchema.parse(updateDraftSliceFields(slice, changes).data);
}

export function confirmWorldbookDraftComplete(entries: WorldbookDraftEntry[]): { ready_to_merge: boolean; ok: boolean; errors: unknown[]; warnings: unknown[]; missing_fields: Array<{ entry?: string; field: string; message: string }>; next_actions: Array<{ entry?: string; field: string; action: string }>; summary: unknown } {
  const result = validateWorldbookDraft(entries);
  const missing_fields = result.errors
    .filter((issue) => /不能为空|必填/.test(issue.message))
    .map((issue) => ({ entry: issue.entry, field: issue.field ?? "unknown", message: issue.message }));
  const seen = new Set<string>();
  const dedupedMissing = missing_fields.filter((issue) => {
    const key = `${issue.entry ?? ""}::${issue.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ready_to_merge: result.valid,
    ok: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    missing_fields: dedupedMissing,
    next_actions: dedupedMissing.map((issue) => ({ entry: issue.entry, field: issue.field, action: `填写 ${issue.field}` })),
    summary: result.summary,
  };
}
