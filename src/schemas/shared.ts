import { z } from "zod";
import { DraftTypeSchema } from "./draft-slice.js";

export const SharedCategorySchema = z.enum(["entries", "assets"]);

export const SharedRegistryEntrySchema = z.object({
  id: z.string().min(1),
  type: DraftTypeSchema,
  category: SharedCategorySchema,
  title: z.string().default(""),
  source_project: z.string().min(1),
  shared_at: z.string(),
  file: z.string().min(1),
});

export const SharedRegistrySchema = z.object({
  version: z.literal(1).default(1),
  entries: z.array(SharedRegistryEntrySchema).default([]),
});

export const ShareSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  shared_id: z.string().min(1).optional(),
  title: z.string().optional(),
  overwrite: z.boolean().default(false),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const UseSharedInputSchema = z.object({
  project_id: z.string(),
  shared_id: z.string().min(1),
  target_id: z.string().min(1).optional(),
  overwrite: z.boolean().default(false),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const ListSharedInputSchema = z.object({
  draft_type: DraftTypeSchema.optional(),
  category: SharedCategorySchema.optional(),
  include_content: z.boolean().default(false),
});

export type SharedCategory = z.infer<typeof SharedCategorySchema>;
export type SharedRegistryEntry = z.infer<typeof SharedRegistryEntrySchema>;
export type SharedRegistry = z.infer<typeof SharedRegistrySchema>;
