import { z } from "zod";

export const HtmlBeautifyConfigSchema = z.object({
  target: z.enum(["statusbar", "global", "both"]).default("statusbar"),
  theme: z.enum(["minimal", "dark", "light", "custom"]).default("minimal"),
  statusbar: z.object({
    html: z.string().default(""),
    scopedCss: z.string().optional(),
    hideRegex: z.boolean().default(true),
  }).default({ html: "", hideRegex: true }),
  regexPolicy: z.object({
    generateHideRegex: z.boolean().default(true),
    generateStatusbarRegex: z.boolean().default(true),
  }).default({ generateHideRegex: true, generateStatusbarRegex: true }),
  variablePaths: z.array(z.string()).default([]),
});

export type HtmlBeautifyConfig = z.infer<typeof HtmlBeautifyConfigSchema>;
