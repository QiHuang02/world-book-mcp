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
  preventRecursion: z.boolean().default(true),
  excludeRecursion: z.boolean().default(true),
});

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

const WorldbookDraftFieldSchema = z.enum([
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
 * 由 draft-field-editor.ts（draft slice 路径）使用，
 * 避免多处独立维护同一字段的 schema 定义出现漂移。
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

export const CreateWorldbookDraftEntriesInputSchema = z.object({
  project_id: z.string(),
  entries: z.array(CreateWorldbookDraftTemplateInputSchema).min(1),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  value.entries.forEach((entry, index) => {
    const comment = entry.comment.trim();
    if (seen.has(comment)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["entries", index, "comment"], message: `comment 重复: ${comment}` });
    }
    seen.add(comment);
  });
});

export type EntryType = z.infer<typeof EntryTypeSchema>;
export type PositionName = z.infer<typeof PositionNameSchema>;
export type WorldbookDraftEntry = z.infer<typeof WorldbookDraftEntrySchema>;
export type CreateWorldbookDraftTemplateInput = z.infer<typeof CreateWorldbookDraftTemplateInputSchema>;
export type WorldbookDraftField = z.infer<typeof WorldbookDraftFieldSchema>;
