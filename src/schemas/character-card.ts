import { z } from "zod";

export const CharacterCardBaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  personality: z.string().default(""),
  scenario: z.string().default(""),
  first_mes: z.string().default(""),
  alternate_greetings: z.array(z.string()).default([]),
  creator_notes: z.string().default(""),
  system_prompt: z.string().default(""),
  post_history_instructions: z.string().default(""),
  tags: z.array(z.string()).default([]),
  creator: z.string().default(""),
  character_version: z.string().default("1.0"),
  talkativeness: z.string().default("0.5"),
});

export const CharacterCardWorldbookConfigSchema = z.object({
  source: z.enum(["project_draft", "none"]).default("project_draft"),
  name: z.string().optional(),
});

export const CharacterCardConfigSchema = z.object({
  card: CharacterCardBaseSchema,
  worldbook: CharacterCardWorldbookConfigSchema.default({ source: "project_draft" }),
});

export const ValidateCharacterCardConfigInputSchema = z.object({
  project_id: z.string(),
  config: CharacterCardConfigSchema.optional(),
});

export const QueryCharacterCardInputSchema = z.object({
  path: z.string().min(1),
  mode: z.enum(["summary", "worldbook_entries", "greetings"]),
});

export type CharacterCardBase = z.infer<typeof CharacterCardBaseSchema>;
export type CharacterCardWorldbookConfig = z.infer<typeof CharacterCardWorldbookConfigSchema>;
export type CharacterCardConfig = z.infer<typeof CharacterCardConfigSchema>;
