import { z } from "zod";
import { ProjectKindSchema } from "./project.js";
import { DraftTypeSchema } from "./draft-slice.js";

export const BuildArtifactTargetSchema = z.enum(["mvu", "html", "regex", "ejs", "all", "worldbook_preview", "character_card_preview"]);

export const FileInputSnapshotSchema = z.object({
  path: z.string(),
  revision: z.number().int().nonnegative().optional(),
  sha256: z.string(),
  bytes: z.number().int().nonnegative(),
  updated_at: z.string().optional(),
});

export const SliceInputSnapshotSchema = z.object({
  id: z.string(),
  type: DraftTypeSchema,
  title: z.string().optional(),
  active: z.boolean(),
  revision: z.number().int().nonnegative(),
  path: z.string(),
  sha256: z.string(),
  source: z.enum(["manual", "imported", "generated", "shared"]).optional(),
});

export const BuildManifestSchema = z.object({
  schema_version: z.literal(1),
  build_id: z.string(),
  status: z.enum(["success", "failed", "partial"]),
  built_at: z.string(),
  tool: z.object({ name: z.literal("world-book-mcp"), version: z.string(), node_version: z.string().optional() }),
  project: z.object({
    project_id: z.string(),
    slug: z.string(),
    name: z.string(),
    project_revision: z.number().int().nonnegative(),
    kind: ProjectKindSchema,
    workspace_revision: z.number().int().nonnegative().optional(),
  }),
  build: z.object({
    requested_by: z.enum(["build_assets", "generate_json", "check_delivery", "manual"]),
    target: z.string(),
    mode: z.literal("full"),
    strict_review: z.enum(["off", "standard", "strict"]),
    force: z.boolean().default(false),
  }),
  inputs: z.object({
    project_json: FileInputSnapshotSchema,
    plan_md: FileInputSnapshotSchema.optional(),
    slices: z.array(SliceInputSnapshotSchema),
    imports: z.array(z.object({ importId: z.string(), path: z.string(), type: z.enum(["worldbook", "character_card"]), sha256_at_import: z.string(), current_sha256: z.string().optional(), changed_since_import: z.boolean() })).default([]),
  }),
  graph: z.object({ nodes: z.array(z.unknown()).default([]), edges: z.array(z.unknown()).default([]) }).default({ nodes: [], edges: [] }),
  artifacts: z.array(z.object({
    id: z.string(),
    target: BuildArtifactTargetSchema,
    path: z.string(),
    media_type: z.enum(["application/json", "text/plain"]).default("application/json"),
    sha256: z.string(),
    bytes: z.number().int().nonnegative(),
    created_at: z.string(),
    input_slice_ids: z.array(z.string()).default([]),
    input_revisions: z.record(z.string(), z.number()).default({}),
    summary: z.unknown().optional(),
    cache: z.object({
      fingerprint: z.string(),
      reused_from_build_id: z.string().optional(),
      reused_from_path: z.string().optional(),
    }).optional(),
    stale: z.boolean().default(false),
  })).default([]),
  validation: z.object({
    validated: z.boolean(),
    validate_tool: z.literal("validate_project"),
    scope: z.string(),
    ok: z.boolean(),
    ready_to_build: z.boolean().optional(),
    ready_to_export: z.boolean(),
    section_status: z.record(z.string(), z.string()).default({}),
    error_count: z.number().int().nonnegative().default(0),
    warning_count: z.number().int().nonnegative().default(0),
    info_count: z.number().int().nonnegative().default(0),
    report_path: z.string().optional(),
  }),
  delivery: z.object({
    checked: z.boolean(),
    export_target: z.enum(["worldbook", "character_card", "both"]),
    ready_to_export: z.boolean(),
    blocking_count: z.number().int().nonnegative().default(0),
    warning_count: z.number().int().nonnegative().default(0),
    checklist_path: z.string().optional(),
    blocking_sections: z.array(z.string()).default([]),
    warning_sections: z.array(z.string()).default([]),
  }),
  exports: z.object({ previews: z.array(z.unknown()).default([]), final_exports: z.array(z.unknown()).default([]) }).default({ previews: [], final_exports: [] }),
  diagnostics: z.object({ stale: z.boolean(), stale_reasons: z.array(z.string()).default([]), warnings: z.array(z.unknown()).default([]), infos: z.array(z.unknown()).default([]) }),
});

export const BuildLatestSchema = z.object({
  build_id: z.string(),
  manifest_path: z.string(),
  built_at: z.string(),
  status: z.enum(["success", "failed", "partial"]),
});

export const ExportRecordSchema = z.object({
  schema_version: z.literal(1),
  export_id: z.string(),
  exported_at: z.string(),
  project_id: z.string(),
  build_id: z.string(),
  target: z.enum(["worldbook", "character_card", "both"]),
  forced: z.boolean(),
  stale_at_export: z.boolean(),
  stale_reasons: z.array(z.string()).default([]),
  outputs: z.array(z.object({ target: z.enum(["worldbook", "character_card"]), preview_path: z.string(), final_path: z.string(), sha256: z.string(), bytes: z.number().int().nonnegative(), overwrite: z.boolean(), backup_path: z.string().optional() })),
  delivery: z.object({ ready_to_export: z.boolean(), blocking_count: z.number().int().nonnegative(), warning_count: z.number().int().nonnegative(), checklist_path: z.string().optional() }),
});

export type BuildManifest = z.infer<typeof BuildManifestSchema>;
export type BuildLatest = z.infer<typeof BuildLatestSchema>;
export type ExportRecord = z.infer<typeof ExportRecordSchema>;
