import { z } from "zod";

export const ProjectOutputKindSchema = z.enum(["worldbook", "character_card", "both"]);
export const ProjectSourceKindSchema = z.enum(["original", "derivative", "modify_existing", "composite"]);

export const WorkspaceProjectEntrySchema = z.object({
  slug: z.string().min(1),
  project_id: z.string().min(1),
  name: z.string().min(1),
  output: ProjectOutputKindSchema,
  source: ProjectSourceKindSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkspaceSchema = z.object({
  version: z.literal(3),
  revision: z.number().int().nonnegative().default(0),
  default_project: z.string().optional(),
  projects: z.array(WorkspaceProjectEntrySchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectOutputKind = z.infer<typeof ProjectOutputKindSchema>;
export type ProjectSourceKind = z.infer<typeof ProjectSourceKindSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceProjectEntry = z.infer<typeof WorkspaceProjectEntrySchema>;
