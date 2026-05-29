import { z } from "zod";

export const PositionSchema = z.enum(["before_char", "after_char", "before_an", "after_an", "at_depth", "before_em", "after_em", "outlet"]);
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
  "style",
  "dialogue",
  "player",
  "other",
]);

export const CardDraftSchema = z.object({
  name: z.string().min(1),
  description: z.literal(""),
  personality: z.string().default(""),
  scenario: z.string().default(""),
  first_mes: z.string().min(1),
  alternate_greetings: z.array(z.string()).default([]),
  mes_example: z.string().default(""),
  creator_notes: z.string().default(""),
  system_prompt: z.string().default(""),
  post_history_instructions: z.string().default(""),
  creator: z.string().default(""),
  character_version: z.string().default("1.0"),
  talkativeness: z.string().default("0.5"),
  fav: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  worldbook: z.object({ include: z.boolean().default(true), name: z.string().optional() }).default({ include: true }),
});

export const WorldbookEntryDraftSchema = z.object({
  id: z.string().min(1),
  comment: z.string().min(1),
  type: EntryTypeSchema.default("other"),
  content: z.string().min(1),
  enabled: z.boolean().default(true),
  constant: z.boolean().default(true),
  keys: z.array(z.string()).default([]),
  secondary_keys: z.array(z.string()).default([]),
  position: PositionSchema.default("after_char"),
  order: z.number().default(100),
  depth: z.number().int().min(0).nullable().default(4),
  scanDepth: z.number().int().min(0).nullable().optional(),
  preventRecursion: z.literal(true),
  excludeRecursion: z.literal(true),
  part: z.string().optional(),
  scope: z.enum(["catalog", "specific"]).optional(),
  status: z.enum(["planned", "drafted", "reviewed", "done"]).optional(),
  abstract: z.string().optional(),
  sourceRefs: z.array(z.string()).optional(),
  rephrase: z.boolean().optional(),
});

export const WorldbookDraftSchema = z.object({
  name: z.string().min(1),
  entries: z.array(WorldbookEntryDraftSchema).default([]),
});

export const RegexScriptDraftSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  findRegex: z.string().min(1),
  replaceString: z.string().default(""),
  replaceFile: z.string().optional(),
  markdownOnly: z.boolean().default(true),
  promptOnly: z.boolean().default(false),
  placement: z.array(z.number().int()).default([2]),
  minDepth: z.number().int().nullable().default(null),
  maxDepth: z.number().int().nullable().default(null),
  runOnEdit: z.boolean().default(false),
  substituteRegex: z.number().int().default(0),
  disabled: z.boolean().default(false),
});

export const AssetsDraftSchema = z.object({
  mvu: z.object({
    enabled: z.boolean().default(false),
    schema: z.string().optional(),
    initvar: z.string().optional(),
    updateRules: z.string().optional(),
    variableList: z.string().optional(),
    outputFormat: z.string().optional(),
    variableListPath: z.string().nullable().default("stat_data"),
    hideRegex: z.boolean().default(true),
    beautifyRegex: z.boolean().default(true),
  }).default({ enabled: false, variableListPath: "stat_data", hideRegex: true, beautifyRegex: true }),
  html: z.object({
    statusbar: z.object({
      enabled: z.boolean().default(false),
      html: z.string().optional(),
      css: z.string().optional(),
      variablePaths: z.array(z.string()).default([]),
      hideRegex: z.boolean().default(true),
      mode: z.enum(["safe_macro", "dynamic_js"]).default("safe_macro"),
    }).default({ enabled: false, variablePaths: [], hideRegex: true, mode: "safe_macro" }),
  }).default({ statusbar: { enabled: false, variablePaths: [], hideRegex: true, mode: "safe_macro" } }),
  regex: z.object({ scripts: z.string().optional() }).default({}),
  ejs: z.object({
    enabled: z.boolean().default(false),
    preprocess: z.object({
      file: z.string().min(1),
      position: PositionSchema.default("before_char"),
      order: z.number().default(14500),
      depth: z.number().int().min(0).nullable().default(0),
    }).optional(),
    entries: z.array(z.object({
      id: z.string().min(1),
      file: z.string().min(1),
      role: z.enum(["controller", "stage", "inline", "helper"]).default("inline"),
      enabled: z.boolean().default(true),
      position: PositionSchema.default("at_depth"),
      order: z.number().default(100),
      depth: z.number().int().min(0).nullable().default(0),
      conditionVariables: z.array(z.string()).default([]),
      complexity: z.enum(["entry_visibility", "paragraph", "dynamic_text"]).optional(),
    })).default([]),
  }).default({ enabled: false, entries: [] }),
});

export type CardDraft = z.infer<typeof CardDraftSchema>;
export type WorldbookDraft = z.infer<typeof WorldbookDraftSchema>;
export type WorldbookEntryDraft = z.infer<typeof WorldbookEntryDraftSchema>;
export type AssetsDraft = z.infer<typeof AssetsDraftSchema>;
export type RegexScriptDraft = z.infer<typeof RegexScriptDraftSchema>;
