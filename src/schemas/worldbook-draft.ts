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


export type EntryType = z.infer<typeof EntryTypeSchema>;
export type PositionName = z.infer<typeof PositionNameSchema>;
export type WorldbookDraftEntry = z.infer<typeof WorldbookDraftEntrySchema>;
export type CreateWorldbookDraftTemplateInput = z.infer<typeof CreateWorldbookDraftTemplateInputSchema>;
