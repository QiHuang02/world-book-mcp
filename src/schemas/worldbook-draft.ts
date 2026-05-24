import { z } from "zod";
import { normalizeWorldbookEntryContent } from "../utils/yaml-xml.js";

/**
 * 世界书条目 `content` 在所有写入路径上的统一规范化：
 * 自动剥离首尾 YAML 文档分隔符 `---`。
 * skill 约束：世界书条目里的 YAML 必须用 XML 标签包裹，不能裸写 `---` 分隔符。
 */
const worldbookContentText = z.string().transform(normalizeWorldbookEntryContent);

export const EntryTypeSchema = z.enum([
  "world_summary",
  "background",
  "character_overview",
  "character_basic",
  "character_personality",
  "item",
  "ability",
  "scene",
  "event",
  "faction",
  "npc",
  "other",
]);

export const PositionNameSchema = z.enum([
  "before_char",
  "after_char",
  "before_an",
  "after_an",
  "at_depth",
  "before_em",
  "after_em",
  "outlet",
]);

export const WorldbookDraftEntrySchema = z.object({
  comment: z.string().min(1),
  entryType: EntryTypeSchema.default("other"),
  keys: z.array(z.string()).default([]),
  secondaryKeys: z.array(z.string()).default([]),
  content: worldbookContentText.default(""),
  characterName: z.string().optional(),
  sourceUid: z.number().int().min(0).optional(),
  constant: z.boolean(),
  position: PositionNameSchema,
  order: z.number(),
  enabled: z.boolean().default(true),
  depth: z.number().int().min(0).optional(),
  scanDepth: z.number().int().min(0).optional(),
  preventRecursion: z.literal(true).default(true),
  excludeRecursion: z.literal(true).default(true),
});

export const SimplifiedWorldbookEntryInputSchema = z.object({
  comment: z.string().min(1),
  content: worldbookContentText.default(""),
  character_name: z.string().optional(),
  characterName: z.string().optional(),
  keys: z.array(z.string()).default([]),
  secondary_keys: z.array(z.string()).optional(),
  secondaryKeys: z.array(z.string()).optional(),
  entry_type: EntryTypeSchema.optional(),
  entryType: EntryTypeSchema.optional(),
  position: PositionNameSchema.optional(),
  order: z.number().optional(),
  constant: z.boolean().optional(),
  enabled: z.boolean().optional(),
  depth: z.number().int().min(0).optional(),
  scan_depth: z.number().int().min(0).nullable().optional(),
  scanDepth: z.number().int().min(0).nullable().optional(),
});

export const DraftTemplateIfExistsSchema = z.enum(["error", "return_existing", "overwrite"]);

export const CreateWorldbookDraftTemplateInputSchema = z.object({
  comment: z.string().min(1),
  entry_type: EntryTypeSchema.optional(),
  entryType: EntryTypeSchema.optional(),
  character_name: z.string().optional(),
  characterName: z.string().optional(),
  position: PositionNameSchema.optional(),
  order: z.number().optional(),
  constant: z.boolean().optional(),
  enabled: z.boolean().optional(),
  scan_depth: z.number().int().min(0).nullable().optional(),
  scanDepth: z.number().int().min(0).nullable().optional(),
});

export const CreateWorldbookDraftEntryInputSchema = CreateWorldbookDraftTemplateInputSchema.extend({
  project_id: z.string(),
  expected_revision: z.number().int().nonnegative().optional(),
  if_exists: DraftTemplateIfExistsSchema.default("error"),
});

export const CreateWorldbookDraftEntriesInputSchema = z.object({
  project_id: z.string(),
  entries: z.array(CreateWorldbookDraftTemplateInputSchema).min(1),
  expected_revision: z.number().int().nonnegative().optional(),
  if_exists: DraftTemplateIfExistsSchema.default("error"),
}).superRefine((value, context) => {
  const seen = new Map<string, number>();
  value.entries.forEach((entry, index) => {
    const comment = entry.comment.trim();
    const previous = seen.get(comment);
    if (previous !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", index, "comment"],
        message: `同一次 create_worldbook_draft_entries 调用中 comment 重复：${comment}；第 ${previous + 1} 项和第 ${index + 1} 项重复，请改用唯一 comment`,
      });
      return;
    }
    seen.set(comment, index);
  });
});

export const WorldbookDraftFieldSchema = z.enum([
  "comment",
  "entry_type",
  "keys",
  "secondary_keys",
  "content",
  "character_name",
  "constant",
  "position",
  "order",
  "enabled",
  "depth",
  "scan_depth",
]);

/**
 * 单个 worldbook draft 字段（snake_case key）允许写入的值约束。
 * 由 worldbook-draft-editor.ts（inline draft 路径）和 draft-field-editor.ts（draft slice 路径）共享，
 * 避免两处独立维护同一字段的 schema 定义出现漂移。
 */
export const WorldbookDraftFieldValueSchemas = {
  comment: z.string().min(1),
  entry_type: EntryTypeSchema,
  keys: z.array(z.string()),
  secondary_keys: z.array(z.string()),
  content: worldbookContentText,
  character_name: z.string().nullable(),
  constant: z.boolean(),
  position: PositionNameSchema,
  order: z.number(),
  enabled: z.boolean(),
  depth: z.number().int().min(0).nullable(),
  scan_depth: z.number().int().min(0).nullable(),
} satisfies Record<z.infer<typeof WorldbookDraftFieldSchema>, z.ZodTypeAny>;

export const UpdateWorldbookDraftFieldInputSchema = z.object({
  project_id: z.string(),
  comment: z.string().min(1),
  field: WorldbookDraftFieldSchema,
  value: z.unknown(),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const UpdateWorldbookDraftFieldsInputSchema = z.object({
  project_id: z.string(),
  comment: z.string().min(1),
  changes: z.record(WorldbookDraftFieldSchema, z.unknown()).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const ConfirmWorldbookDraftCompleteInputSchema = z.object({
  project_id: z.string(),
});

export const ListWorldbookDraftEntriesInputSchema = z.object({
  project_id: z.string(),
  include_content: z.boolean().default(false),
});

export const GetWorldbookDraftEntryInputSchema = z.object({
  project_id: z.string(),
  comment: z.string().min(1),
});

export const DeleteWorldbookDraftEntryInputSchema = z.object({
  project_id: z.string(),
  comment: z.string().min(1),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const ValidateWorldbookDraftInputSchema = z.object({
  project_id: z.string().optional(),
  entries: z.array(WorldbookDraftEntrySchema).optional(),
});

export const GenerateWorldbookJsonInputSchema = z.object({
  project_id: z.string(),
  worldbook_name: z.string().min(1),
  output_path: z.string().optional(),
  overwrite: z.boolean().default(false),
  strict_review: z.boolean().default(false),
});

export type EntryType = z.infer<typeof EntryTypeSchema>;
export type PositionName = z.infer<typeof PositionNameSchema>;
export type WorldbookDraftEntry = z.infer<typeof WorldbookDraftEntrySchema>;
export type CreateWorldbookDraftTemplateInput = z.infer<typeof CreateWorldbookDraftTemplateInputSchema>;
export type DraftTemplateIfExists = z.infer<typeof DraftTemplateIfExistsSchema>;
export type WorldbookDraftField = z.infer<typeof WorldbookDraftFieldSchema>;
