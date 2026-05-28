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
  version: z.literal(4).default(4),
  entries: z.array(SharedRegistryEntrySchema).default([]),
});

export type SharedCategory = z.infer<typeof SharedCategorySchema>;
export type SharedRegistryEntry = z.infer<typeof SharedRegistryEntrySchema>;
export type SharedRegistry = z.infer<typeof SharedRegistrySchema>;
