import { z } from "zod";

export const MvuConfigSchema = z.object({
  enabled: z.boolean().default(true),
  style: z.literal("zod").default("zod"),
  schema_script: z.string().default(""),
  initvar: z.string().default(""),
  update_rules: z.string().default(""),
  output_format: z.string().optional(),
  variable_list_path: z.union([z.string().min(1), z.literal(false)]).default("stat_data"),
  hide_regex: z.boolean().default(true),
  beautify_regex: z.boolean().default(true),
});

export const CreateMvuSchemaTemplateInputSchema = z.object({
  project_id: z.string().optional(),
  character_names: z.array(z.string().min(1)).min(1).default(["角色"]),
  variable_list_path: z.string().min(1).default("stat_data"),
});

export const SubmitMvuConfigInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema,
});

export const ValidateMvuConfigInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema.optional(),
});

export const BuildMvuAssetsInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema.optional(),
});

export type MvuConfig = z.infer<typeof MvuConfigSchema>;
