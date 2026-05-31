import { z } from "zod";

export const OutputKindSchema = z.enum(["worldbook", "character_card", "both"]);
export const SourceKindSchema = z.enum(["original", "derivative", "modify_existing", "composite"]);
export const AssetStateSchema = z.enum(["disabled", "planned", "enabled"]);

export const WorkspaceProjectSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  output: OutputKindSchema,
  source: SourceKindSchema,
  projectPath: z.string().min(1),
});

export const WorkspaceSchema = z.object({
  schemaVersion: z.literal(5),
  activeProject: z.string().optional(),
  projects: z.array(WorkspaceProjectSchema).default([]),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(5),
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  kind: z.object({
    output: OutputKindSchema,
    source: SourceKindSchema,
    assets: z.object({
      mvu: AssetStateSchema.default("disabled"),
      html: AssetStateSchema.default("disabled"),
      regex: AssetStateSchema.default("disabled"),
      ejs: AssetStateSchema.default("disabled"),
      tavernHelper: AssetStateSchema.default("disabled"),
    }),
  }),
  paths: z.object({
    plan: z.string().default("plan.md"),
    draft: z.object({
      card: z.string().default("draft/card.yaml"),
      worldbook: z.string().default("draft/worldbook.yaml"),
      assets: z.string().default("draft/assets.yaml"),
    }),
    sourceRoot: z.string().default("source"),
    reports: z.string().default("reports"),
    exports: z.string().default("exports"),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OutputKind = z.infer<typeof OutputKindSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type AssetState = z.infer<typeof AssetStateSchema>;
export type WorkspaceProject = z.infer<typeof WorkspaceProjectSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export function assetState(planned?: boolean): AssetState {
  return planned ? "planned" : "disabled";
}
