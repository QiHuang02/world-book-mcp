import { z } from "zod";

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
  content: z.string().default(""),
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

export const WorldbookEntryPlanSchema = z.object({
  comment: z.string().min(1),
  entryType: EntryTypeSchema,
  position: PositionNameSchema,
  order: z.number(),
  constant: z.boolean(),
  keys: z.array(z.string()).default([]),
  reason: z.string(),
});

export const SimplifiedWorldbookEntryInputSchema = z.object({
  comment: z.string().min(1),
  content: z.string().default(""),
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

export const UpsertWorldbookEntryInputSchema = SimplifiedWorldbookEntryInputSchema.extend({
  project_id: z.string(),
  expected_revision: z.number().int().nonnegative().optional(),
  match_by_keys: z.boolean().default(false),
});

export const UpsertWorldbookEntriesInputSchema = z.object({
  project_id: z.string(),
  entries: z.array(SimplifiedWorldbookEntryInputSchema).min(1),
  expected_revision: z.number().int().nonnegative().optional(),
  match_by_keys: z.boolean().default(false),
});

export const DraftWorldbookEntriesInputSchema = z.object({
  project_id: z.string(),
  entries: z.array(WorldbookDraftEntrySchema).min(1),
});

export const ValidateWorldbookDraftInputSchema = z.object({
  project_id: z.string().optional(),
  entries: z.array(WorldbookDraftEntrySchema).optional(),
});

export const CreateWorldbookDraftTemplateInputSchema = z.object({
  project_id: z.string(),
  save: z.boolean().default(false),
});

export const DraftEntryPatchSchema = z.object({
  index: z.number().int().min(0).optional(),
  comment: z.string().optional(),
  content: z.string().optional(),
  keys: z.array(z.string()).optional(),
  secondaryKeys: z.array(z.string()).optional(),
  constant: z.boolean().optional(),
  position: PositionNameSchema.optional(),
  order: z.number().optional(),
  enabled: z.boolean().optional(),
  depth: z.number().int().min(0).optional(),
  scanDepth: z.number().int().min(0).nullable().optional(),
}).refine((value) => value.index !== undefined || value.comment, {
  message: "必须提供 index 或 comment 用于定位条目",
});

export const UpdateWorldbookDraftEntriesInputSchema = z.object({
  project_id: z.string(),
  patches: z.array(DraftEntryPatchSchema).min(1),
  validate: z.boolean().default(true),
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
export type WorldbookEntryPlan = z.infer<typeof WorldbookEntryPlanSchema>;
