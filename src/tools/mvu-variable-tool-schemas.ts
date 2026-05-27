import { z } from "zod";
import { MvuRewriteOptionsSchema, MvuVariableDefinitionSchema } from "../schemas/mvu.js";

export const ListMvuVariablesInputSchema = z.object({
  project_id: z.string(),
  include_raw: z.boolean().default(false),
});

export const UpsertMvuVariableInputSchema = MvuVariableDefinitionSchema.extend({
  project_id: z.string(),
  rewrite: MvuRewriteOptionsSchema.optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const RemoveMvuVariableInputSchema = z.object({
  project_id: z.string(),
  path: z.array(z.string().min(1)).min(1),
  rewrite: MvuRewriteOptionsSchema.optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const RewriteMvuVariablesInputSchema = z.object({
  project_id: z.string(),
  variables: z.array(MvuVariableDefinitionSchema).min(1),
  rewrite: MvuRewriteOptionsSchema.extend({ removeMissing: z.boolean().default(true) }).optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateMvuSourceInputSchema = z.object({
  project_id: z.string(),
  changes: z.object({
    schemaScript: z.string().optional(),
    initvar: z.string().optional(),
    updateRules: z.string().optional(),
    outputFormat: z.string().nullable().optional(),
    variableListPath: z.union([z.string().min(1), z.null()]).optional(),
    hideRegex: z.boolean().optional(),
    beautifyRegex: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});
