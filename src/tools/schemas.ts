import { z } from "zod";
import { EntryTypeSchema, RegexScriptDraftSchema } from "../schemas/draft.js";
import { OutputKindSchema, SourceKindSchema } from "../schemas/project.js";

export const InitProjectInputSchema = z.object({
  name: z.string().min(1),
  output: OutputKindSchema,
  source: SourceKindSchema,
  assets: z.object({ mvu: z.boolean().optional(), html: z.boolean().optional(), regex: z.boolean().optional(), ejs: z.boolean().optional(), tavernHelper: z.boolean().optional() }).optional(),
  if_exists: z.enum(["error", "overwrite"]).default("error"),
});

export const ProjectIdInputSchema = z.object({ project_id: z.string().default("active") });

export const UpdatePlanInputSchema = z.object({
  project_id: z.string().default("active"),
  mode: z.enum(["rewrite", "replace_section", "append_section", "append_decision", "append_todo", "update_todo", "append_acceptance", "append_verification", "append_risk"]),
  section: z.string().optional(),
  content: z.string().optional(),
  decision: z.object({ question: z.string(), answer: z.string(), note: z.string().optional() }).optional(),
  todo: z.object({ text: z.string(), done: z.boolean().default(false) }).optional(),
  todo_match: z.string().optional(),
  done: z.boolean().optional(),
});

export const WriteDraftInputSchema = z.object({
  project_id: z.string().default("active"),
  target: z.enum(["card", "worldbook", "assets"]),
  mode: z.enum(["rewrite", "patch", "append_entry", "remove_entry"]).default("rewrite"),
  data: z.unknown().optional(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  value: z.unknown().optional(),
  entry_id: z.string().optional(),
});

export const WriteSourceFileInputSchema = z.object({
  project_id: z.string().default("active"),
  path: z.string().min(1),
  content: z.string(),
  overwrite: z.boolean().default(false),
});

export const ValidateProjectInputSchema = z.object({ project_id: z.string().default("active") });

export const GenerateJsonInputSchema = z.object({
  project_id: z.string().default("active"),
  target: z.enum(["worldbook", "character_card", "both"]).optional(),
  overwrite: z.boolean().default(false),
  output_path: z.string().optional(),
  output_paths: z.object({ worldbook: z.string().optional(), character_card: z.string().optional() }).optional(),
  force: z.boolean().default(false),
});

export const QueryProjectInputSchema = z.object({
  project_id: z.string().default("active"),
  include_plan: z.boolean().default(false),
  include_draft: z.boolean().default(false),
});

export const ReadSourceFileInputSchema = z.object({
  project_id: z.string().default("active"),
  path: z.string().min(1),
  max_length: z.number().int().positive().max(100000).default(20000),
});

export const ResumeProjectInputSchema = z.object({
  project_id: z.string().default("active"),
  include_plan: z.boolean().default(false),
  include_entries: z.boolean().default(false),
});

export const CheckDeliveryInputSchema = z.object({
  project_id: z.string().default("active"),
  require_done_entries: z.boolean().default(false),
});

export const ImportExistingJsonInputSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  if_exists: z.enum(["error", "overwrite"]).default("error"),
});

export const ImportNovaConfigInputSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  if_exists: z.enum(["error", "overwrite"]).default("error"),
});

export const RepairProjectInputSchema = z.object({
  project_id: z.string().default("active"),
  dry_run: z.boolean().default(false),
});

export const ValidateMvuInputSchema = z.object({
  project_id: z.string().default("active"),
});

export const ConvertMvuPathInputSchema = z.object({
  path: z.string().min(1),
  from: z.enum(["auto", "ejs", "json_patch", "yaml_dot"]).default("auto"),
  to: z.enum(["ejs", "json_patch", "yaml_dot"]),
});

const EntryTypeListSchema = z.array(EntryTypeSchema).default([]);
const ConfigureThresholdSchema = z.record(EntryTypeSchema, z.union([z.number(), z.literal("Infinity"), z.null()])).optional();

export const ConfigureDraftInputSchema = z.object({
  project_id: z.string().default("active"),
  mode: z.enum(["preview", "apply"]).default("preview"),
  profile: z.enum(["single_character", "multi_character", "worldbook"]).default("single_character"),
  strategy: z.enum(["explicit", "auto"]).default("explicit"),
  typeLists: z.object({ before_char: EntryTypeListSchema.optional(), after_char: EntryTypeListSchema.optional(), depth: EntryTypeListSchema.optional() }).optional(),
  strategyThresholds: ConfigureThresholdSchema,
  partOrder: z.record(z.string(), z.number()).optional(),
  requiredParts: z.array(z.string()).default([]),
  entries: z.array(z.object({
    id: z.string().min(1),
    comment: z.string().min(1),
    type: EntryTypeSchema.optional(),
    content: z.string().min(1),
    strategy: z.enum(["blue", "green"]).optional(),
    keys: z.array(z.string()).optional(),
    order: z.number().optional(),
    part: z.string().optional(),
    scope: z.enum(["catalog", "specific"]).optional(),
    status: z.enum(["planned", "drafted", "reviewed", "done"]).optional(),
    abstract: z.string().optional(),
    sourceRefs: z.array(z.string()).default([]),
    rephrase: z.boolean().default(false),
  })).min(1),
});

const MvuVariableKindSchema = z.enum(["string", "number", "boolean", "enum", "object", "record", "custom"]);
const MvuVariableInputSchema = z.object({
  path: z.array(z.string().min(1)).min(1),
  kind: MvuVariableKindSchema.optional(),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  hidden: z.boolean().optional(),
  readonly: z.boolean().optional(),
});
const MvuRewriteSchema = z.object({ schema: z.boolean().optional(), initvar: z.boolean().optional(), variableList: z.boolean().optional(), updateRules: z.boolean().optional(), outputFormat: z.boolean().optional() }).optional();

export const ListMvuVariablesInputSchema = z.object({ project_id: z.string().default("active") });
export const UpsertMvuVariableInputSchema = z.object({ project_id: z.string().default("active"), variable: MvuVariableInputSchema, rewrite: MvuRewriteSchema });
export const RemoveMvuVariableInputSchema = z.object({ project_id: z.string().default("active"), path: z.array(z.string().min(1)).min(1), rewrite: MvuRewriteSchema });
export const RewriteMvuVariablesInputSchema = z.object({ project_id: z.string().default("active"), variables: z.array(MvuVariableInputSchema), rewrite: MvuRewriteSchema });
export const ApplyMvuPresetInputSchema = z.object({ project_id: z.string().default("active"), preset: z.enum(["minimal", "nova", "tavern_cards"]).default("minimal"), overwrite: z.boolean().default(false) });

const EntryStatusSchema = z.enum(["planned", "drafted", "reviewed", "done"]);
export const UpdateEntryStatusInputSchema = z.object({
  project_id: z.string().default("active"),
  entry_id: z.string().min(1),
  status: EntryStatusSchema.optional(),
  abstract: z.string().optional(),
  sourceRefs: z.array(z.string()).optional(),
  part: z.string().optional(),
  scope: z.enum(["catalog", "specific"]).optional(),
});
export const QueryEntriesInputSchema = z.object({
  project_id: z.string().default("active"),
  status: EntryStatusSchema.optional(),
  part: z.string().optional(),
  scope: z.enum(["catalog", "specific"]).optional(),
  include_content: z.boolean().default(false),
});
export const GenerateTavernSyncConfigInputSchema = z.object({
  project_id: z.string().default("active"),
  name: z.string().optional(),
  type: z.enum(["worldbook", "preset"]).default("worldbook"),
  tavern_name: z.string().optional(),
  local_path: z.string().optional(),
  export_path: z.string().optional(),
  user_name: z.string().optional(),
  output_path: z.string().optional(),
  overwrite: z.boolean().default(false),
});

export const CreateEjsStageTemplateInputSchema = z.object({
  project_id: z.string().default("active"),
  controller_id: z.string().optional(),
  variable: z.string().min(1),
  base_profile: z.string().optional(),
  common_derivations: z.array(z.string()).default([]),
  stages: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), value: z.string().min(1), condition: z.string().optional(), content: z.string().optional(), exclusive_derivations: z.array(z.string()).default([]), rephrase_notes: z.array(z.string()).default([]) })).min(1),
  overwrite: z.boolean().default(false),
});

export const CreateStatusbarTemplateInputSchema = z.object({
  project_id: z.string().default("active"),
  mode: z.enum(["safe_macro", "dynamic_js"]).default("safe_macro"),
  title: z.string().optional(),
  variables: z.array(z.object({ label: z.string().min(1), path: z.string().min(1) })).min(1),
  theme: z.enum(["simple", "dark", "moon"]).default("dark"),
  overwrite: z.boolean().default(false),
});

export const CreateFrontendBeautifyTemplateInputSchema = z.object({
  project_id: z.string().default("active"),
  id: z.string().min(1),
  label: z.string().optional(),
  tag: z.string().min(1),
  mode: z.enum(["text", "structured"]).default("text"),
  html: z.string().optional(),
  css: z.string().optional(),
  overwrite: z.boolean().default(false),
});

export const UpsertRegexScriptInputSchema = RegexScriptDraftSchema.extend({
  project_id: z.string().default("active"),
  overwrite: z.boolean().default(false),
});

export const UpsertTavernHelperScriptInputSchema = z.object({
  project_id: z.string().default("active"),
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.string().optional(),
  content_file: z.string().optional(),
  enabled: z.boolean().default(false),
  info: z.string().optional(),
  allow_external: z.boolean().default(false),
  buttons: z.array(z.object({ name: z.string().min(1), visible: z.boolean().default(true) })).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
  overwrite: z.boolean().default(false),
});

export const CreateAdultEntryTemplateInputSchema = z.object({
  project_id: z.string().default("active"),
  id: z.string().min(1),
  character_name: z.string().min(1),
  type: z.enum(["character_nsfw_palette", "character_sexual_characteristics", "character_xp_card"]),
  source_path: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  keys: z.array(z.string()).optional(),
  strategy: z.enum(["blue", "green"]).default("blue"),
  consent_boundary: z.array(z.string()).default([]),
  age_gate: z.enum(["adult_confirmed"]).optional(),
  overwrite: z.boolean().default(false),
  register: z.boolean().default(true),
});
