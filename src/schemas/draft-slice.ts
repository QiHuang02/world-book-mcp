import { z } from "zod";
import { CharacterCardBaseSchema } from "./character-card.js";
import { EjsEntryConfigSchema } from "./ejs.js";
import { HtmlRegexScriptConfigSchema } from "./html-beautify.js";
import { MvuConfigSchema } from "./mvu.js";
import { WorldbookDraftEntrySchema } from "./worldbook-draft.js";

export const DraftTypeSchema = z.enum([
  "worldbook_entry",
  "character_profile",
  "character_greetings",
  "mvu_schema",
  "mvu_update_rules",
  "html_statusbar",
  "html_regex",
  "ejs_entry",
  "style_profile",
  "chapter_outline",
]);

export const CharacterGreetingsDraftSchema = z.object({
  first_mes: z.string().default(""),
  alternate_greetings: z.array(z.string()).default([]),
});

export const MvuSchemaDraftDataSchema = MvuConfigSchema.pick({
  enabled: true,
  style: true,
  schema_script: true,
  output_format: true,
  variable_list_path: true,
});

export const MvuUpdateRulesDraftDataSchema = MvuConfigSchema.pick({
  enabled: true,
  initvar: true,
  update_rules: true,
  hide_regex: true,
  beautify_regex: true,
});

export const HtmlStatusbarDraftDataSchema = z.object({
  enabled: z.boolean().default(true),
  target: z.enum(["statusbar", "global", "both"]).default("statusbar"),
  theme: z.enum(["minimal", "dark", "light", "custom"]).default("minimal"),
  html: z.string().default(""),
  hide_regex: z.boolean().default(true),
  source: z.enum(["html", "mvu", "third_party", "unknown"]).default("html"),
});

export const HtmlRegexDraftDataSchema = HtmlRegexScriptConfigSchema.extend({
  source: z.enum(["html", "mvu", "third_party", "unknown"]).default("html"),
});

export const EjsEntryDraftDataSchema = EjsEntryConfigSchema.extend({
  source: z.enum(["imported", "generated", "manual"]).default("manual"),
  variable_paths: z.array(z.string()).default([]),
  template_type: z.enum(["phase_profile", "palette", "custom"]).default("custom"),
});

export const DraftSliceDataSchemas = {
  worldbook_entry: WorldbookDraftEntrySchema,
  character_profile: CharacterCardBaseSchema.extend({
    include_worldbook: z.boolean().default(true),
    worldbook_name: z.string().optional(),
  }),
  character_greetings: CharacterGreetingsDraftSchema,
  mvu_schema: MvuSchemaDraftDataSchema,
  mvu_update_rules: MvuUpdateRulesDraftDataSchema,
  html_statusbar: HtmlStatusbarDraftDataSchema,
  html_regex: HtmlRegexDraftDataSchema,
  ejs_entry: EjsEntryDraftDataSchema,
  style_profile: z.record(z.string(), z.unknown()).default({}),
  chapter_outline: z.record(z.string(), z.unknown()).default({}),
} satisfies Record<z.infer<typeof DraftTypeSchema>, z.ZodTypeAny>;

export const DraftSliceSchema = z.object({
  id: z.string().min(1),
  type: DraftTypeSchema,
  title: z.string().optional(),
  enabled: z.boolean().default(true),
  data: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative().default(0),
}).superRefine((slice, context) => {
  const schema = DraftSliceDataSchemas[slice.type];
  const parsed = schema.safeParse(slice.data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({ ...issue, path: ["data", ...issue.path] });
    }
  }
});

export const CreateDraftSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  title: z.string().optional(),
  preset: z.string().optional(),
  if_exists: z.enum(["error", "return_existing", "overwrite"]).default("error"),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const UpdateDraftFieldInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  field_path: z.string().min(1),
  value: z.unknown(),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateDraftFieldsInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  changes: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const ListDraftSlicesInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema.optional(),
  include_content: z.boolean().default(false),
});

export const GetDraftSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
});

export const DeleteDraftSliceInputSchema = GetDraftSliceInputSchema.extend({
  expected_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const ValidateDraftInputSchema = z.object({
  project_id: z.string(),
  scope: z.enum(["all", "worldbook", "character_card", "mvu", "html", "ejs", "style", "chapter"]).default("all"),
  strict: z.boolean().default(false),
});

export const BuildAssetsInputSchema = z.object({
  project_id: z.string(),
  target: z.enum(["mvu", "html", "ejs", "all"]).default("all"),
});

export const GenerateJsonInputSchema = z.object({
  project_id: z.string(),
  target: z.enum(["worldbook", "character_card", "both"]).optional(),
  output_path: z.string().optional(),
  overwrite: z.boolean().default(false),
  strict_review: z.boolean().optional(),
});

export const QueryJsonInputSchema = z.object({
  path: z.string().min(1),
  mode: z.enum(["summary", "worldbook_entries", "greetings", "search", "uid", "stats"]),
  query: z.string().optional(),
  uid: z.number().int().optional(),
});

export type DraftType = z.infer<typeof DraftTypeSchema>;
export type DraftSliceDataSchemasByType = {
  [K in DraftType]: z.infer<(typeof DraftSliceDataSchemas)[K]>;
};
export type DraftSlice = z.infer<typeof DraftSliceSchema>;
export type CreateDraftSliceInput = z.infer<typeof CreateDraftSliceInputSchema>;
export type ValidateDraftScope = z.infer<typeof ValidateDraftInputSchema>["scope"];
