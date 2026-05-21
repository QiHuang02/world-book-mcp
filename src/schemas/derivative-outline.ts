import { z } from "zod";
import { SourceRefSchema } from "./extraction.js";

export const DerivativeSourceKindSchema = z.enum(["novel", "game", "wiki", "web_research", "mixed"]);
export const DerivativeFocusSchema = z.enum(["characters", "world", "items", "events", "style", "chapters"]);

export const ChapterLineIndexSchema = z.object({
  chapter: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  summary: z.string().default(""),
});

export const CharacterExtractionDimensionSchema = z.object({
  dimension: z.enum(["basic_first_appearance", "appearance", "identity", "personality_evidence", "key_events", "relationships", "abilities_items", "chapter_appearances"]),
  technique_summary: z.string().default(""),
  source_quotes: z.array(z.string()).default([]),
  forbidden_terms_notes: z.array(z.string()).default([]),
  extracted_result: z.string().default(""),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const CharacterExtractionOutlineSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  one_line_profile: z.string().default(""),
  appearance_chapters: z.array(z.string()).default([]),
  dimensions: z.array(CharacterExtractionDimensionSchema).default([]),
});

export const WorldExtractionDimensionSchema = z.object({
  dimension: z.enum(["geography", "history", "factions", "rules", "society"]),
  technique_summary: z.string().default(""),
  source_quotes: z.array(z.string()).default([]),
  extracted_result: z.string().default(""),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const DerivativePlannedEntrySchema = z.object({
  comment: z.string().min(1),
  entryType: z.string().min(1),
  position: z.string().min(1),
  activation: z.enum(["constant", "keyword"]),
  order: z.number(),
  estimated_tokens: z.number().int().min(0).optional(),
  dependency_chapters: z.array(z.string()).default([]),
});

export const DerivativeExtractionOutlineSchema = z.object({
  title: z.string().min(1),
  source_kind: DerivativeSourceKindSchema,
  focus: z.array(DerivativeFocusSchema).default(["characters", "world", "items", "events"]),
  chapter_index: z.array(ChapterLineIndexSchema).default([]),
  character_overview: z.array(z.string()).default([]),
  characters: z.array(CharacterExtractionOutlineSchema).default([]),
  world_type: z.enum(["A", "B", "C"]).optional(),
  world_dimensions: z.array(WorldExtractionDimensionSchema).default([]),
  important_chapters: z.array(z.object({ chapter: z.string().min(1), reason: z.string().min(1), related_entries: z.array(z.string()).default([]) })).default([]),
  planned_entries: z.array(DerivativePlannedEntrySchema).default([]),
  notes: z.array(z.string()).default([]),
});

export type DerivativeExtractionOutline = z.infer<typeof DerivativeExtractionOutlineSchema>;
export type DerivativeSourceKind = z.infer<typeof DerivativeSourceKindSchema>;
export type DerivativeFocus = z.infer<typeof DerivativeFocusSchema>;
