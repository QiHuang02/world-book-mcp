import { z } from "zod";
import { RegexScriptDraftSchema } from "../schemas/regex.js";

export const ListRegexScriptsInputSchema = z.object({
  project_id: z.string(),
  slice_id: z.string().optional(),
  include_disabled: z.boolean().default(true),
  include_inactive_slices: z.boolean().default(false),
});

export const UpsertRegexScriptInputSchema = z.object({
  project_id: z.string(),
  slice_id: z.string(),
  script: RegexScriptDraftSchema,
  if_exists: z.enum(["error", "overwrite", "merge"]).default("error"),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateRegexScriptInputSchema = z.object({
  project_id: z.string(),
  slice_id: z.string(),
  script_id: z.string(),
  changes: RegexScriptDraftSchema.omit({ id: true, source: true, origin: true }).partial().refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const RemoveRegexScriptInputSchema = z.object({
  project_id: z.string(),
  slice_id: z.string(),
  script_id: z.string(),
  deactivate_empty_slice: z.boolean().default(true),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const ReorderRegexScriptsInputSchema = z.object({
  project_id: z.string(),
  slice_id: z.string(),
  script_order: z.array(z.string()).min(1),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const MoveRegexScriptInputSchema = z.object({
  project_id: z.string(),
  from_slice_id: z.string(),
  to_slice_id: z.string(),
  script_id: z.string(),
  new_script_id: z.string().optional(),
  new_order: z.number().optional(),
  expected_from_slice_revision: z.number().int().nonnegative().optional(),
  expected_to_slice_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});
