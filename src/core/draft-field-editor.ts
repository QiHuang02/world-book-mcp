import { z } from "zod";
import { CharacterCardBaseSchema } from "../schemas/character-card.js";
import { DraftSliceDataSchemas, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { EjsEntryConfigSchema } from "../schemas/ejs.js";
import { HtmlRegexScriptConfigSchema } from "../schemas/html-beautify.js";
import { MvuConfigSchema } from "../schemas/mvu.js";
import { PositionNameSchema, EntryTypeSchema, WorldbookDraftEntrySchema } from "../schemas/worldbook-draft.js";
import { nowIso } from "../utils/ids.js";
import { uniqueStrings } from "../utils/strings.js";

const FieldSchemas: Record<DraftType, Record<string, z.ZodTypeAny>> = {
  worldbook_entry: {
    comment: z.string().min(1),
    entryType: EntryTypeSchema,
    entry_type: EntryTypeSchema,
    keys: z.array(z.string()),
    secondaryKeys: z.array(z.string()),
    secondary_keys: z.array(z.string()),
    content: z.string(),
    characterName: z.string().optional(),
    character_name: z.string().nullable(),
    constant: z.boolean(),
    position: PositionNameSchema,
    order: z.number(),
    enabled: z.boolean(),
    depth: z.number().int().min(0).nullable(),
    scanDepth: z.number().int().min(0).nullable(),
    scan_depth: z.number().int().min(0).nullable(),
  },
  character_profile: {
    ...CharacterCardBaseSchema.shape,
    include_worldbook: z.boolean(),
    worldbook_name: z.string().optional(),
  },
  character_greetings: {
    first_mes: z.string(),
    alternate_greetings: z.array(z.string()),
  },
  mvu_schema: {
    enabled: z.boolean(),
    style: z.literal("zod"),
    schema_script: z.string(),
    output_format: z.string().optional(),
    variable_list_path: MvuConfigSchema.shape.variable_list_path,
  },
  mvu_update_rules: {
    enabled: z.boolean(),
    initvar: z.string(),
    update_rules: z.string(),
    hide_regex: z.boolean(),
    beautify_regex: z.boolean(),
  },
  html_statusbar: {
    enabled: z.boolean(),
    target: z.enum(["statusbar", "global", "both"]),
    theme: z.enum(["minimal", "dark", "light", "custom"]),
    html: z.string(),
    hide_regex: z.boolean(),
  },
  html_regex: HtmlRegexScriptConfigSchema.shape,
  ejs_entry: EjsEntryConfigSchema.shape,
  style_profile: {},
  chapter_outline: {},
};

export function updateDraftSliceField(slice: DraftSlice, fieldPath: string, value: unknown): DraftSlice {
  if (fieldPath.includes(".") || fieldPath.includes("[") || fieldPath.includes("]")) {
    throw new Error(`暂不支持嵌套 field_path=${fieldPath}；请使用该 draft_type 允许的顶层字段`);
  }
  const fieldSchemas = FieldSchemas[slice.type];
  const schema = fieldSchemas[fieldPath];
  if (!schema && slice.type !== "style_profile" && slice.type !== "chapter_outline") {
    throw new Error(`draft_type=${slice.type} 不支持字段 ${fieldPath}`);
  }
  const data = { ...(slice.data as Record<string, unknown>) };
  const parsed = schema ? schema.parse(value) : value;
  const canonicalField = canonicalFieldName(slice.type, fieldPath);
  if (parsed === null || parsed === undefined) delete data[canonicalField];
  else data[canonicalField] = parsed;
  const normalizedData = normalizeData(slice.type, data);
  return {
    ...slice,
    data: DraftSliceDataSchemas[slice.type].parse(normalizedData),
    updatedAt: nowIso(),
    revision: slice.revision + 1,
  };
}

export function updateDraftSliceFields(slice: DraftSlice, changes: Record<string, unknown>): DraftSlice {
  let next = slice;
  for (const [field, value] of Object.entries(changes)) {
    next = updateDraftSliceField(next, field, value);
  }
  return next;
}

// Only worldbook_entry keeps snake_case aliases for compatibility with SillyTavern-style fields;
// other draft types use their schema field names directly.
function canonicalFieldName(type: DraftType, field: string): string {
  if (type === "worldbook_entry") {
    if (field === "entry_type") return "entryType";
    if (field === "secondary_keys") return "secondaryKeys";
    if (field === "character_name") return "characterName";
    if (field === "scan_depth") return "scanDepth";
  }
  return field;
}

function normalizeData(type: DraftType, data: Record<string, unknown>): unknown {
  if (type !== "worldbook_entry") return data;
  if (data.characterName === "") delete data.characterName;
  if (data.depth === null) delete data.depth;
  if (data.scanDepth === null) delete data.scanDepth;
  if (Array.isArray(data.keys)) data.keys = uniqueStrings(data.keys);
  if (Array.isArray(data.secondaryKeys)) data.secondaryKeys = uniqueStrings(data.secondaryKeys);
  return WorldbookDraftEntrySchema.parse(data);
}
