import { z } from "zod";

export const HtmlRegexScriptConfigSchema = z.object({
  name: z.string().min(1),
  findRegex: z.string().min(1),
  replaceString: z.string().default(""),
  markdownOnly: z.boolean().default(true),
  promptOnly: z.boolean().default(false),
  placement: z.array(z.number().int()).min(1).default([2]),
  runOnEdit: z.boolean().default(false),
});

export const HtmlBeautifyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  target: z.enum(["statusbar", "global", "both"]).default("statusbar"),
  theme: z.enum(["minimal", "dark", "light", "custom"]).default("minimal"),
  statusbar: z.object({
    enabled: z.boolean().default(true),
    html: z.string().default(""),
    hide_regex: z.boolean().default(true),
  }).default({ enabled: true, html: "", hide_regex: true }),
  global: z.object({
    enabled: z.boolean().default(false),
    regex_scripts: z.array(HtmlRegexScriptConfigSchema).default([]),
  }).default({ enabled: false, regex_scripts: [] }),
});

export const CreateHtmlBeautifyTemplateInputSchema = z.object({
  project_id: z.string().optional(),
  target: z.enum(["statusbar", "global", "both"]).default("statusbar"),
  theme: z.enum(["minimal", "dark", "light", "custom"]).default("minimal"),
});

export const SubmitHtmlBeautifyConfigInputSchema = z.object({
  project_id: z.string(),
  html: HtmlBeautifyConfigSchema,
});

export const ValidateHtmlBeautifyConfigInputSchema = z.object({
  project_id: z.string(),
  html: HtmlBeautifyConfigSchema.optional(),
});

export const BuildHtmlBeautifyAssetsInputSchema = z.object({
  project_id: z.string(),
  html: HtmlBeautifyConfigSchema.optional(),
});

export type HtmlRegexScriptConfig = z.infer<typeof HtmlRegexScriptConfigSchema>;
export type HtmlBeautifyConfig = z.infer<typeof HtmlBeautifyConfigSchema>;
