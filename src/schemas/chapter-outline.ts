import { z } from "zod";

export const ChapterEntrySchema = z.object({
  title: z.string().min(1),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
  summary: z.string().default(""),
  key_events: z.array(z.string()).default([]),
  character_state_changes: z.array(z.string()).default([]),
  world_changes: z.array(z.string()).default([]),
  item_ability_reveals: z.array(z.string()).default([]),
  keys: z.array(z.string()).default([]),
});

export const ChapterOutlineSchema = z.object({
  title: z.string().min(1),
  chapters: z.array(ChapterEntrySchema).default([]),
});

export type ChapterEntry = z.infer<typeof ChapterEntrySchema>;
export type ChapterOutline = z.infer<typeof ChapterOutlineSchema>;
