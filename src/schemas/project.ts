import { z } from "zod";
import { ChapterOutlineSchema } from "./chapter-outline.js";
import { PendingDecisionSchema, RecordedDecisionSchema } from "./decision.js";
import { DerivativeExtractionOutlineSchema } from "./derivative-outline.js";
import { ExtractionResultSchema } from "./extraction.js";
import { StyleProfileSchema } from "./style-profile.js";
import { WorldbookDraftEntrySchema } from "./worldbook-draft.js";
import { CharacterCardBaseSchema, CharacterCardConfigSchema } from "./character-card.js";
import { MvuConfigSchema } from "./mvu.js";
import { HtmlBeautifyConfigSchema } from "./html-beautify.js";
import { EjsConfigSchema } from "./ejs.js";

const ExtraRegexScriptSchema = z.object({
  scriptName: z.string().min(1),
  findRegex: z.string(),
  replaceString: z.string().default(""),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(z.number().int()).default([2]),
  disabled: z.boolean().default(false),
  markdownOnly: z.boolean().default(true),
  promptOnly: z.boolean().default(false),
  runOnEdit: z.boolean().default(false),
  substituteRegex: z.number().int().default(0),
  minDepth: z.number().nullable().default(null),
  maxDepth: z.number().nullable().default(null),
});

export const ProjectPlanMetadataSchema = z.object({
  task_type: z.enum(["original", "derivative", "mixed", "modify_existing"]).optional(),
  output_target: z.enum(["worldbook", "character_card", "both"]).optional(),
  export_filename: z.string().optional(),
  strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional(),
  enabled_assets: z.object({
    mvu: z.boolean().optional(),
    html: z.boolean().optional(),
    ejs: z.boolean().optional(),
  }).default({}),
}).default({ enabled_assets: {} });

export const ProjectImportRecordSchema = z.object({
  path: z.string(),
  type: z.enum(["worldbook", "character_card"]),
  importedAt: z.string(),
  worldbookEntryCount: z.number().int().nonnegative().optional(),
  hasMvu: z.boolean().optional(),
  hasHtml: z.boolean().optional(),
  hasEjs: z.boolean().optional(),
});

export const ProjectLogMetadataSchema = z.object({
  session_id: z.string(),
  latest_log_path: z.string(),
}).optional();

export const ProjectProfileSchema = CharacterCardBaseSchema.extend({
  include_worldbook: z.boolean().default(true),
  worldbook_name: z.string().optional(),
});

export const ProjectGreetingsSchema = z.object({
  first_mes: z.string().default(""),
  alternate_greetings: z.array(z.string()).default([]),
});

export const WorldbuildingSummarySchema = z.object({
  world_type: z.enum(["A_realistic_background", "B_small_world", "C_large_world"]),
  title: z.string().min(1),
  summary: z.string().default(""),
  geography: z.string().optional(),
  history: z.string().optional(),
  factions: z.string().optional(),
  rules: z.string().optional(),
  society: z.string().optional(),
  technology: z.string().optional(),
  boundaries: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string(),
  output_type: z.enum(["worldbook", "character_card", "mixed"]).optional(),
  profile: ProjectProfileSchema.optional(),
  greetings: ProjectGreetingsSchema.optional(),
  style: StyleProfileSchema.optional(),
  chapters: ChapterOutlineSchema.optional(),
  extraction: ExtractionResultSchema.optional(),
  derivativeOutline: DerivativeExtractionOutlineSchema.optional(),
  styleProfile: StyleProfileSchema.optional(),
  chapterOutline: ChapterOutlineSchema.optional(),
  worldbuildingSummary: WorldbuildingSummarySchema.optional(),
  draft: z.array(WorldbookDraftEntrySchema).optional(),
  importedWorldbookPath: z.string().optional(),
  pendingDecisions: z.array(PendingDecisionSchema).default([]),
  recordedDecisions: z.array(RecordedDecisionSchema).default([]),
  revision: z.number().int().nonnegative().default(0),
  characterCardConfig: CharacterCardConfigSchema.optional(),
  importedCharacterCardPath: z.string().optional(),
  mvuConfig: MvuConfigSchema.optional(),
  htmlBeautifyConfig: HtmlBeautifyConfigSchema.optional(),
  ejsConfig: EjsConfigSchema.optional(),
  extraRegexScripts: z.array(ExtraRegexScriptSchema).optional().default([]),
  plan: ProjectPlanMetadataSchema,
  imports: z.array(ProjectImportRecordSchema).default([]),
  logs: ProjectLogMetadataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
export type ProjectGreetings = z.infer<typeof ProjectGreetingsSchema>;
export type WorldbuildingSummary = z.infer<typeof WorldbuildingSummarySchema>;
export type ProjectPlanMetadata = z.infer<typeof ProjectPlanMetadataSchema>;
export type ProjectImportRecord = z.infer<typeof ProjectImportRecordSchema>;
export type Project = z.infer<typeof ProjectSchema>;
