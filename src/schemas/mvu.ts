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
  variable_list_path: z.union([z.string().min(1), z.null()]).default("stat_data"),
  hide_regex: z.boolean().default(true),
  beautify_regex: z.boolean().default(true),
});

const MvuVariableKindSchema = z.enum(["string", "number", "boolean", "enum", "record", "object", "custom"]);

const MvuVariableDefinitionSchema = z.object({
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
});

const RewriteOptionsSchema = z.object({
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
});

export const UpsertMvuVariableInputSchema = MvuVariableDefinitionSchema.extend({
  project_id: z.string(),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
}).merge(RewriteOptionsSchema);

export const RemoveMvuVariableInputSchema = z.object({
  project_id: z.string(),
  path: z.array(z.string().min(1)).min(1),
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const RewriteMvuVariablesInputSchema = z.object({
  project_id: z.string(),
  variables: z.array(MvuVariableDefinitionSchema).min(1),
  rewrite_initvar: z.boolean().default(true),
  rewrite_update_rules: z.boolean().default(true),
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export type MvuConfig = z.infer<typeof MvuConfigSchema>;
export type MvuVariableDefinition = z.infer<typeof MvuVariableDefinitionSchema>;
