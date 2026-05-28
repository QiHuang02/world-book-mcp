import { z } from "zod";

export const MvuConfigSchema = z.object({
  schemaScript: z.string().default(""),
  variableListPath: z.union([z.string().min(1), z.null()]).default("stat_data"),
  hideRegex: z.boolean().default(true),
  beautifyRegex: z.boolean().default(true),
});

const MvuVariableKindSchema = z.enum(["string", "number", "boolean", "enum", "record", "object", "custom"]);

export const MvuVariableDefinitionSchema = z.object({
  path: z.array(z.string().min(1)).min(1),
  kind: MvuVariableKindSchema.default("string"),
  schemaExpression: z.string().min(1).optional(),
  defaultValue: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  enumValues: z.array(z.string().min(1)).min(1).optional(),
  description: z.string().optional(),
  readonly: z.boolean().optional(),
  hidden: z.boolean().optional(),
  updateRule: z.string().optional(),
});

export const MvuRewriteOptionsSchema = z.object({
  schemaScript: z.boolean().default(true),
  initvar: z.boolean().default(true),
  updateRules: z.boolean().default(true),
  outputFormat: z.boolean().default(false),
});

export type MvuConfig = z.infer<typeof MvuConfigSchema>;
export type MvuVariableDefinition = z.infer<typeof MvuVariableDefinitionSchema>;
export type MvuRewriteOptions = z.infer<typeof MvuRewriteOptionsSchema>;
