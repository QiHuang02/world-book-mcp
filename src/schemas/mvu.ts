import { z } from "zod";
import { normalizeMvuYamlField } from "../utils/yaml-xml.js";

/**
 * MVU 文本字段（initvar / update_rules / output_format）的输入侧规范化：
 * 自动剥离首尾 YAML 文档分隔符 `---`，并在用户/AI 误把 XML 包裹版本贴进来时解包成纯 YAML。
 * 这三个字段在 `MvuConfig` 里约定存储原始 YAML，由 `buildMvuAssets` 在合成世界书条目时再统一加 XML 包裹。
 */
const mvuInitvarText = z.string().transform((value) => normalizeMvuYamlField(value, ["initvar"]));
const mvuUpdateRulesText = z.string().transform((value) => normalizeMvuYamlField(value, ["variable_update_rules"]));
const mvuOutputFormatText = z.string().transform((value) => normalizeMvuYamlField(value, ["variable_output_format"]));

export const MvuConfigSchema = z.object({
  enabled: z.boolean().default(true),
  style: z.literal("zod").default("zod"),
  schema_script: z.string().default(""),
  initvar: mvuInitvarText.default(""),
  update_rules: mvuUpdateRulesText.default(""),
  output_format: mvuOutputFormatText.optional(),
  variable_list_path: z.union([z.string().min(1), z.literal(false)]).default("stat_data"),
  hide_regex: z.boolean().default(true),
  beautify_regex: z.boolean().default(true),
});

export const CreateMvuSchemaTemplateInputSchema = z.object({
  project_id: z.string().optional(),
  character_names: z.array(z.string().min(1)).min(1).default(["角色"]),
  variable_list_path: z.string().min(1).default("stat_data"),
});

export const SubmitMvuConfigInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema,
});

export const UpsertMvuSchemaInputSchema = z.object({
  project_id: z.string(),
  character_names: z.array(z.string().min(1)).optional(),
  variable_list_path: z.union([z.string().min(1), z.literal(false)]).optional(),
  schema_script: z.string().optional(),
  output_format: mvuOutputFormatText.optional(),
  enabled: z.boolean().optional(),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const UpsertMvuUpdateRulesInputSchema = z.object({
  project_id: z.string(),
  initvar: mvuInitvarText.optional(),
  update_rules: mvuUpdateRulesText.optional(),
  hide_regex: z.boolean().optional(),
  beautify_regex: z.boolean().optional(),
  enabled: z.boolean().optional(),
  expected_revision: z.number().int().nonnegative().optional(),
});

export const ValidateMvuConfigInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema.optional(),
});

export const BuildMvuAssetsInputSchema = z.object({
  project_id: z.string(),
  mvu: MvuConfigSchema.optional(),
});

export const MvuVariableKindSchema = z.enum(["string", "number", "boolean", "enum", "record", "object", "custom"]);

export const MvuVariableDefinitionSchema = z.object({
  path: z.array(z.string().min(1)).min(1),
  kind: MvuVariableKindSchema.default("string"),
  schema_expression: z.string().min(1).optional(),
  default_value: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  enum_values: z.array(z.string().min(1)).min(1).optional(),
  description: z.string().optional(),
  readonly: z.boolean().optional(),
  hidden: z.boolean().optional(),
  update_rule: z.string().optional(),
});

export const ListMvuVariablesInputSchema = z.object({
  project_id: z.string(),
  schema_slice_id: z.string().min(1),
});

const RewriteOptionsSchema = z.object({
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
});

export const UpsertMvuVariableInputSchema = MvuVariableDefinitionSchema.extend({
  project_id: z.string(),
  schema_slice_id: z.string().min(1),
  rules_slice_id: z.string().min(1).optional(),
  expected_schema_slice_revision: z.number().int().nonnegative().optional(),
  expected_rules_slice_revision: z.number().int().nonnegative().optional(),
}).merge(RewriteOptionsSchema);

export const RemoveMvuVariableInputSchema = z.object({
  project_id: z.string(),
  schema_slice_id: z.string().min(1),
  rules_slice_id: z.string().min(1).optional(),
  path: z.array(z.string().min(1)).min(1),
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
  expected_schema_slice_revision: z.number().int().nonnegative().optional(),
  expected_rules_slice_revision: z.number().int().nonnegative().optional(),
});

export const RewriteMvuVariablesInputSchema = z.object({
  project_id: z.string(),
  schema_slice_id: z.string().min(1),
  rules_slice_id: z.string().min(1).optional(),
  variables: z.array(MvuVariableDefinitionSchema).min(1),
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
  expected_schema_slice_revision: z.number().int().nonnegative().optional(),
  expected_rules_slice_revision: z.number().int().nonnegative().optional(),
});

export type MvuConfig = z.infer<typeof MvuConfigSchema>;
export type MvuVariableDefinition = z.infer<typeof MvuVariableDefinitionSchema>;
