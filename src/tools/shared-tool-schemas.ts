import { z } from "zod";
import { DraftTypeSchema } from "../schemas/draft-slice.js";
import { SharedCategorySchema } from "../schemas/shared.js";

export const ShareSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  shared_id: z.string().min(1).optional(),
  title: z.string().optional(),
  overwrite: z.boolean().default(false),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const UseSharedInputSchema = z.object({
  project_id: z.string(),
  shared_id: z.string().min(1),
  target_id: z.string().min(1).optional(),
  overwrite: z.boolean().default(false),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const ListSharedInputSchema = z.object({
  draft_type: DraftTypeSchema.optional(),
  category: SharedCategorySchema.optional(),
  include_content: z.boolean().default(false),
});
