import { z } from "zod";
import { ChapterOutlineSchema } from "./chapter-outline.js";
import { PendingDecisionSchema, RecordedDecisionSchema } from "./decision.js";
import { DerivativeExtractionOutlineSchema } from "./derivative-outline.js";
import { ExtractionResultSchema } from "./extraction.js";
import { StyleProfileSchema } from "./style-profile.js";
import { WorldbookDraftEntrySchema } from "./worldbook-draft.js";
import { WorldbookPatchSchema } from "./worldbook-patch.js";
import { CharacterCardConfigSchema, CharacterCardPatchSchema } from "./character-card.js";
import { MvuConfigSchema } from "./mvu.js";
import { HtmlBeautifyConfigSchema } from "./html-beautify.js";
import { EjsConfigSchema } from "./ejs.js";

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
  patches: z.array(WorldbookPatchSchema).default([]),
  pendingDecisions: z.array(PendingDecisionSchema).default([]),
  recordedDecisions: z.array(RecordedDecisionSchema).default([]),
  revision: z.number().int().nonnegative().default(0),
  characterCardConfig: CharacterCardConfigSchema.optional(),
  importedCharacterCardPath: z.string().optional(),
  characterCardPatches: z.array(CharacterCardPatchSchema).default([]),
  mvuConfig: MvuConfigSchema.optional(),
  htmlBeautifyConfig: HtmlBeautifyConfigSchema.optional(),
  ejsConfig: EjsConfigSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorldbuildingSummary = z.infer<typeof WorldbuildingSummarySchema>;
export type Project = z.infer<typeof ProjectSchema>;
