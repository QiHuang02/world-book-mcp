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

export const CreateCharacterCardTemplateInputSchema = z.object({
  project_id: z.string().optional(),
  name: z.string().min(1),
  include_worldbook: z.boolean().default(true),
  greeting_count: z.number().int().min(0).max(10).default(3),
});

export const UpsertCharacterProfileInputSchema = z.object({
  project_id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  first_mes: z.string().optional(),
  alternate_greetings: z.array(z.string()).optional(),
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  tags: z.array(z.string()).optional(),
  creator: z.string().optional(),
  character_version: z.string().optional(),
  talkativeness: z.string().optional(),
  include_worldbook: z.boolean().optional(),
  worldbook_name: z.string().optional(),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const SubmitCharacterCardConfigInputSchema = z.object({
  project_id: z.string(),
  config: CharacterCardConfigSchema,
});

export const ValidateCharacterCardConfigInputSchema = z.object({
  project_id: z.string(),
  config: CharacterCardConfigSchema.optional(),
});

export const GenerateCharacterCardJsonInputSchema = z.object({
  project_id: z.string(),
  output_path: z.string().optional(),
  overwrite: z.boolean().default(false),
  strict_review: z.boolean().default(false),
});

export const QueryCharacterCardInputSchema = z.object({
  path: z.string().min(1),
  mode: z.enum(["summary", "worldbook_entries", "greetings"]),
});

export type CharacterCardBase = z.infer<typeof CharacterCardBaseSchema>;
export type CharacterCardWorldbookConfig = z.infer<typeof CharacterCardWorldbookConfigSchema>;
export type CharacterCardConfig = z.infer<typeof CharacterCardConfigSchema>;
