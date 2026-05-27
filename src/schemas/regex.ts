import { z } from "zod";

export const RegexSourceSchema = z.enum(["standalone", "third_party", "mvu", "html", "manual", "imported"]);
export const RegexAssetSourceSchema = z.enum(["mvu", "html", "standalone", "third_party"]);

export const RegexScriptDraftSchema = z.object({
  id: z.string().min(1),
  scriptName: z.string().min(1),
  order: z.number().default(100),
  findRegex: z.string().min(1),
  replaceString: z.string().default(""),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(z.number().int()).min(1).default([2]),
  disabled: z.boolean().default(false),
  markdownOnly: z.boolean().default(true),
  promptOnly: z.boolean().default(false),
  runOnEdit: z.boolean().default(false),
  substituteRegex: z.number().int().default(0),
  minDepth: z.number().int().nullable().default(null),
  maxDepth: z.number().int().nullable().default(null),
  source: RegexSourceSchema.optional(),
  origin: z.object({
    sourcePath: z.string().optional(),
    scriptName: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
  }).optional(),
  notes: z.string().optional(),
});

export const RegexSliceDataSchema = z.object({
  order: z.number().default(100),
  purpose: z.enum(["standalone", "third_party", "html_support", "mvu_support", "cleanup", "formatting", "custom"]).default("standalone"),
  scripts: z.array(RegexScriptDraftSchema).default([]),
});

export type RegexSource = z.infer<typeof RegexSourceSchema>;
export type RegexAssetSource = z.infer<typeof RegexAssetSourceSchema>;
export type RegexScriptDraft = z.infer<typeof RegexScriptDraftSchema>;
export type RegexSliceData = z.infer<typeof RegexSliceDataSchema>;
