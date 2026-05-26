import { z } from "zod";
import { DraftSliceDataSchemas, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { EjsSliceDataSchema, HtmlSliceDataSchema, MvuSliceDataSchema } from "../schemas/draft-slice.js";
import { WorldbookDraftEntrySchema, WorldbookDraftFieldValueSchemas } from "../schemas/worldbook-draft.js";
import { nowIso } from "../utils/ids.js";
import { setValueAtPath } from "../utils/path-patch.js";
import { uniqueStrings } from "../utils/strings.js";

const entryFieldSchemas = {
  comment: WorldbookDraftFieldValueSchemas.comment,
  entryType: WorldbookDraftFieldValueSchemas.entry_type,
  entry_type: WorldbookDraftFieldValueSchemas.entry_type,
  keys: WorldbookDraftFieldValueSchemas.keys,
  secondaryKeys: WorldbookDraftFieldValueSchemas.secondary_keys,
  secondary_keys: WorldbookDraftFieldValueSchemas.secondary_keys,
  content: WorldbookDraftFieldValueSchemas.content,
  characterName: WorldbookDraftFieldValueSchemas.character_name.optional().or(z.string()),
  character_name: WorldbookDraftFieldValueSchemas.character_name,
  constant: WorldbookDraftFieldValueSchemas.constant,
  position: WorldbookDraftFieldValueSchemas.position,
  order: WorldbookDraftFieldValueSchemas.order,
  enabled: WorldbookDraftFieldValueSchemas.enabled,
  depth: WorldbookDraftFieldValueSchemas.depth,
  scanDepth: WorldbookDraftFieldValueSchemas.scan_depth,
  scan_depth: WorldbookDraftFieldValueSchemas.scan_depth,
} as const satisfies Record<string, z.ZodTypeAny>;

const FieldSchemas: Record<DraftType, Record<string, z.ZodTypeAny>> = {
  entry: entryFieldSchemas,
  mvu: MvuSliceDataSchema.shape,
  html: HtmlSliceDataSchema.shape,
  ejs: EjsSliceDataSchema.shape,
};

export function updateDraftSliceField(slice: DraftSlice, fieldPath: string, value: unknown): DraftSlice {
  if (fieldPath.includes(".") || fieldPath.includes("[") || fieldPath.includes("]")) {
    return updateNestedDraftSliceField(slice, fieldPath, value);
  }
  const fieldSchemas = FieldSchemas[slice.type];
  const schema = fieldSchemas[fieldPath];
  if (!schema) throw new Error(`draft_type=${slice.type} 不支持字段 ${fieldPath}`);
  const data = { ...(slice.data as Record<string, unknown>) };
  const parsed = schema.parse(value);
  const canonicalField = canonicalFieldName(slice.type, fieldPath);
  if (parsed === null || parsed === undefined) delete data[canonicalField];
  else data[canonicalField] = parsed;
  if (slice.type === "ejs" && canonicalField === "role" && parsed === "stage") data.enabled = false;
  return parsedSlice(slice, normalizeData(slice.type, data));
}

export function updateDraftSliceFields(slice: DraftSlice, changes: Record<string, unknown>): DraftSlice {
  let next = slice;
  const explicitEnabled = Object.prototype.hasOwnProperty.call(changes, "enabled");
  for (const [field, value] of Object.entries(changes)) {
    next = updateDraftSliceField(next, field, value);
  }
  if (slice.type === "ejs" && changes.role === "stage" && !explicitEnabled) {
    next = updateDraftSliceField(next, "enabled", false);
  }
  return next;
}

function updateNestedDraftSliceField(slice: DraftSlice, fieldPath: string, value: unknown): DraftSlice {
  const data = setValueAtPath(slice.data, fieldPath, value) as Record<string, unknown>;
  return parsedSlice(slice, normalizeData(slice.type, data));
}

function parsedSlice(slice: DraftSlice, data: unknown): DraftSlice {
  return {
    ...slice,
    data: DraftSliceDataSchemas[slice.type].parse(data),
    updatedAt: nowIso(),
    revision: slice.revision + 1,
  };
}

function canonicalFieldName(type: DraftType, field: string): string {
  if (type === "entry") {
    if (field === "entry_type") return "entryType";
    if (field === "secondary_keys") return "secondaryKeys";
    if (field === "character_name") return "characterName";
    if (field === "scan_depth") return "scanDepth";
  }
  return field;
}

function normalizeData(type: DraftType, data: Record<string, unknown>): unknown {
  if (type === "ejs") return normalizeEjsData(data);
  if (type !== "entry") return data;
  if (typeof data.characterName === "string") data.characterName = data.characterName.trim();
  if (data.characterName === "") delete data.characterName;
  if (data.depth === null) delete data.depth;
  if (data.scanDepth === null) delete data.scanDepth;
  if (Array.isArray(data.keys)) data.keys = uniqueStrings(data.keys);
  if (Array.isArray(data.secondaryKeys)) data.secondaryKeys = uniqueStrings(data.secondaryKeys);
  return WorldbookDraftEntrySchema.parse(data);
}

function normalizeEjsData(data: Record<string, unknown>): unknown {
  if (data.role === "stage" && data.enabled === undefined) data.enabled = false;
  return data;
}
