import { z } from "zod";
import { PositionNameSchema } from "./worldbook-draft.js";

export const EjsEntryConfigSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["controller", "stage", "inline", "helper"]),
  content: z.string().default(""),
  keys: z.array(z.string()).default([]),
  constant: z.boolean().default(true),
  position: PositionNameSchema.default("after_char"),
  order: z.number().default(100),
  enabled: z.boolean().default(true),
  depth: z.number().int().optional(),
  scanDepth: z.number().int().optional(),
  variablePaths: z.array(z.string()).default([]),
  templateType: z.enum(["phase_profile", "palette", "custom"]).default("custom"),
  stages: z.array(z.object({
    name: z.string().min(1),
    condition: z.string().min(1),
    targetSliceId: z.string().min(1),
  })).optional(),
});

export const EjsConfigSchema = z.object({
  entries: z.array(EjsEntryConfigSchema).default([]),
});

export type EjsEntryConfig = z.infer<typeof EjsEntryConfigSchema>;
export type EjsConfig = z.infer<typeof EjsConfigSchema>;
