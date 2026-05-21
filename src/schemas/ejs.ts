import { z } from "zod";
import { PositionNameSchema } from "./worldbook-draft.js";

export const EjsEntryConfigSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["controller", "stage", "inline", "helper"]),
  content: z.string().default(""),
  keys: z.array(z.string()).default([]),
  constant: z.boolean().default(true),
  position: PositionNameSchema.default("after_char"),
  order: z.number().default(100),
  enabled: z.boolean().default(true),
  depth: z.number().int().optional(),
  scanDepth: z.number().int().optional(),
});

export const EjsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  template_type: z.enum(["phase_profile", "palette", "custom"]).default("phase_profile"),
  variable_paths: z.array(z.string()).default([]),
  entries: z.array(EjsEntryConfigSchema).default([]),
});

export const CreateEjsTemplateInputSchema = z.object({
  project_id: z.string().optional(),
  template_type: z.enum(["phase_profile", "palette", "custom"]).default("phase_profile"),
  character_name: z.string().min(1),
  affection_path: z.string().default(""),
  relationship_path: z.string().default(""),
});

export const SubmitEjsConfigInputSchema = z.object({
  project_id: z.string(),
  ejs: EjsConfigSchema,
});

export const ValidateEjsConfigInputSchema = z.object({
  project_id: z.string(),
  ejs: EjsConfigSchema.optional(),
});

export const BuildEjsEntriesInputSchema = z.object({
  project_id: z.string(),
  ejs: EjsConfigSchema.optional(),
});

export type EjsEntryConfig = z.infer<typeof EjsEntryConfigSchema>;
export type EjsConfig = z.infer<typeof EjsConfigSchema>;
