import { z } from "zod";
import { ChapterOutlineSchema } from "./chapter-outline.js";
import { PendingDecisionSchema, RecordedDecisionSchema } from "./decision.js";
import { DerivativeExtractionOutlineSchema } from "./derivative-outline.js";
import { ExtractionResultSchema } from "./extraction.js";
import { StyleProfileSchema } from "./style-profile.js";
import { WorldbookDraftEntrySchema } from "./worldbook-draft.js";
import { CharacterCardConfigSchema } from "./character-card.js";
import { MvuConfigSchema } from "./mvu.js";
import { HtmlBeautifyConfigSchema } from "./html-beautify.js";
import { EjsConfigSchema } from "./ejs.js";

export const ProjectPlanMetadataSchema = z.object({
  task_type: z.enum(["original", "derivative", "mixed", "modify_existing"]).optional(),
  output_target: z.enum(["worldbook", "character_card", "both"]).optional(),
  export_filename: z.string().optional(),
  strict_review: z.boolean().optional(),
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
  name: z.string(),
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
  plan: ProjectPlanMetadataSchema,
  imports: z.array(ProjectImportRecordSchema).default([]),
  logs: ProjectLogMetadataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorldbuildingSummary = z.infer<typeof WorldbuildingSummarySchema>;
export type ProjectPlanMetadata = z.infer<typeof ProjectPlanMetadataSchema>;
export type ProjectImportRecord = z.infer<typeof ProjectImportRecordSchema>;
export type Project = z.infer<typeof ProjectSchema>;
