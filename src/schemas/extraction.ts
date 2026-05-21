import { z } from "zod";

export const SourceRefSchema = z.object({
  sourceId: z.string().optional(),
  researchId: z.string().optional(),
  url: z.string().url().optional(),
  note: z.string().optional(),
  locator: z.string().optional(),
});

export const CharacterFactSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  firstAppearance: z.string().optional(),
  appearance: z.array(z.string()).default([]),
  identity: z.string().optional(),
  personalityEvidence: z.array(z.string()).default([]),
  keyEvents: z.array(z.string()).default([]),
  relationships: z.array(z.string()).default([]),
  abilities: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const WorldFactSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["geography", "history", "faction", "rule", "society", "other"]).default("other"),
  facts: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const ItemFactSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("item"),
  facts: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const EventFactSchema = z.object({
  name: z.string().min(1),
  summary: z.string().min(1),
  participants: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const ExtractionResultSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  characters: z.array(CharacterFactSchema).default([]),
  world: z.array(WorldFactSchema).default([]),
  items: z.array(ItemFactSchema).default([]),
  events: z.array(EventFactSchema).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
});

export const SubmitExtractionResultInputSchema = ExtractionResultSchema.omit({ projectId: true }).extend({
  project_id: z.string(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type CharacterFact = z.infer<typeof CharacterFactSchema>;
export type WorldFact = z.infer<typeof WorldFactSchema>;
export type ItemFact = z.infer<typeof ItemFactSchema>;
export type EventFact = z.infer<typeof EventFactSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
