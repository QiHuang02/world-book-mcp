import { z } from "zod";

export const WorkspaceProjectEntrySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  output_type: z.enum(["worldbook", "character_card", "mixed"]),
});

export const WorkspaceSchema = z.object({
  version: z.literal(2),
  revision: z.number().int().nonnegative().default(0),
  default_project: z.string().optional(),
  projects: z.array(WorkspaceProjectEntrySchema).default([]),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceProjectEntry = z.infer<typeof WorkspaceProjectEntrySchema>;
