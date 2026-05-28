import { z } from "zod";
import { PendingDecisionSchema, RecordedDecisionSchema } from "./decision.js";
import { CharacterCardBaseSchema } from "./character-card.js";
import { ProjectOutputKindSchema, ProjectSourceKindSchema } from "./workspace.js";
import { RegexAssetSourceSchema } from "./regex.js";
import { PlanItemSchema } from "./plan.js";

const DEFAULT_SOURCE_MANIFEST = {
  sourceRoot: "source",
  profile: "source/profile.yaml",
  greetings: { first: "source/greetings/first.md", alternates: [] as string[] },
  entriesDir: "source/entries",
  mvuDir: "source/mvu",
  ejsDir: "source/ejs",
  html: { statusbar: "source/statusbar.html" },
  regexDir: "source/regex",
  exportTargets: {},
};

export const SourceManifestSchema = z.object({
  sourceRoot: z.string().default(DEFAULT_SOURCE_MANIFEST.sourceRoot),
  profile: z.string().default(DEFAULT_SOURCE_MANIFEST.profile),
  greetings: z.object({
    first: z.string().default(DEFAULT_SOURCE_MANIFEST.greetings.first),
    alternates: z.array(z.string()).default([]),
  }).default(DEFAULT_SOURCE_MANIFEST.greetings),
  entriesDir: z.string().default(DEFAULT_SOURCE_MANIFEST.entriesDir),
  mvuDir: z.string().default(DEFAULT_SOURCE_MANIFEST.mvuDir),
  ejsDir: z.string().default(DEFAULT_SOURCE_MANIFEST.ejsDir),
  html: z.object({ statusbar: z.string().default(DEFAULT_SOURCE_MANIFEST.html.statusbar) }).default(DEFAULT_SOURCE_MANIFEST.html),
  regexDir: z.string().default(DEFAULT_SOURCE_MANIFEST.regexDir),
  exportTargets: z.object({
    worldbook: z.string().optional(),
    characterCard: z.string().optional(),
  }).default(DEFAULT_SOURCE_MANIFEST.exportTargets),
}).default(DEFAULT_SOURCE_MANIFEST);

export const AssetKindStateSchema = z.object({
  planned: z.boolean().default(false),
  enabled: z.boolean().default(false),
  imported: z.boolean().default(false),
  generated: z.boolean().default(false),
  slice_count: z.number().int().nonnegative().default(0),
});

export const RegexAssetKindStateSchema = AssetKindStateSchema.extend({
  sources: z.array(RegexAssetSourceSchema).default([]),
});

export const ProjectKindSchema = z.object({
  output: ProjectOutputKindSchema,
  source: ProjectSourceKindSchema,
  assets: z.object({
    mvu: AssetKindStateSchema,
    html: AssetKindStateSchema,
    regex: RegexAssetKindStateSchema,
    ejs: AssetKindStateSchema,
  }),
});

export const OpeningDesignSchema = z.object({
  mode: z.enum(["first_meeting", "established_relationship", "event_hook", "crisis_or_mission", "daily_interaction", "custom"]),
  user_role: z.enum(["unspecified", "observer", "invited", "collaborator", "opponent", "event_trigger"]),
  premise: z.string().min(1),
  user_constraints: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ProjectPlanMetadataSchema = z.object({
  export_filename: z.string().optional(),
  strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional(),
  summary: z.string().optional(),
  scope: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  non_goals: z.array(z.string()).default([]),
  plan_items: z.array(PlanItemSchema).default([]),
  acceptance_criteria: z.array(z.string()).default([]),
  verification_steps: z.array(z.string()).default([]),
  risk_register: z.array(z.string()).default([]),
}).default({ scope: [], assumptions: [], non_goals: [], plan_items: [], acceptance_criteria: [], verification_steps: [], risk_register: [] });

export const ProjectImportRecordSchema = z.object({
  importId: z.string().min(1),
  path: z.string(),
  type: z.enum(["worldbook", "character_card"]),
  importedAt: z.string(),
  sourceHash: z.string(),
  sourceBytes: z.number().int().nonnegative(),
  summary: z.object({
    entryCount: z.number().int().nonnegative().default(0),
    regexScriptCount: z.number().int().nonnegative().default(0),
    hasCharacterProfile: z.boolean().default(false),
    hasGreetings: z.boolean().default(false),
    hasMvu: z.boolean().default(false),
    hasHtml: z.boolean().default(false),
    hasRegex: z.boolean().default(false),
    hasEjs: z.boolean().default(false),
  }),
  exportTarget: z.object({
    worldbookPath: z.string().optional(),
    characterCardPath: z.string().optional(),
  }).optional(),
});

export const ProjectLogMetadataSchema = z.object({
  session_id: z.string(),
  latest_log_path: z.string(),
}).optional();

export const ProjectProfileSchema = CharacterCardBaseSchema.extend({
  include_worldbook: z.boolean().default(true),
  worldbook_name: z.string().optional(),
});

export const ProjectGreetingsSchema = z.object({
  first_mes: z.string().default(""),
  alternate_greetings: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(4),
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: ProjectKindSchema,
  opening: OpeningDesignSchema.optional(),
  sourceManifest: SourceManifestSchema,
  plan: ProjectPlanMetadataSchema,
  profile: ProjectProfileSchema.optional(),
  greetings: ProjectGreetingsSchema.optional(),
  imports: z.array(ProjectImportRecordSchema).default([]),
  pendingDecisions: z.array(PendingDecisionSchema).default([]),
  recordedDecisions: z.array(RecordedDecisionSchema).default([]),
  logs: ProjectLogMetadataSchema,
  revision: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AssetKindState = z.infer<typeof AssetKindStateSchema>;
export type RegexAssetKindState = z.infer<typeof RegexAssetKindStateSchema>;
export type ProjectKind = z.infer<typeof ProjectKindSchema>;
export type OpeningDesign = z.infer<typeof OpeningDesignSchema>;
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
export type ProjectGreetings = z.infer<typeof ProjectGreetingsSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type ProjectPlanMetadata = z.infer<typeof ProjectPlanMetadataSchema>;
export type ProjectImportRecord = z.infer<typeof ProjectImportRecordSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export function defaultProjectKind(input: { output: z.infer<typeof ProjectOutputKindSchema>; source: z.infer<typeof ProjectSourceKindSchema>; assets?: Partial<Record<"mvu" | "html" | "regex" | "ejs", boolean>> }): ProjectKind {
  const asset = (planned = false): AssetKindState => ({ planned, enabled: false, imported: false, generated: false, slice_count: 0 });
  return ProjectKindSchema.parse({
    output: input.output,
    source: input.source,
    assets: {
      mvu: asset(Boolean(input.assets?.mvu)),
      html: asset(Boolean(input.assets?.html)),
      regex: { ...asset(Boolean(input.assets?.regex)), sources: [] },
      ejs: asset(Boolean(input.assets?.ejs)),
    },
  });
}
