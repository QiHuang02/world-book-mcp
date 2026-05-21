import { z } from "zod";

export const ReliabilitySchema = z.enum(["official", "wiki", "forum", "unknown"]);

export const WebResearchItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  summary: z.string().min(1),
  facts: z.array(z.string()).default([]),
  reliability: ReliabilitySchema.default("unknown"),
});

export const WebResearchBundleSchema = z.object({
  id: z.string(),
  topic: z.string().min(1),
  items: z.array(WebResearchItemSchema).min(1),
  createdAt: z.string(),
});

export const IngestWebResearchInputSchema = z.object({
  project_id: z.string().optional(),
  topic: z.string().min(1),
  items: z.array(WebResearchItemSchema).min(1),
});

export type Reliability = z.infer<typeof ReliabilitySchema>;
export type WebResearchItem = z.infer<typeof WebResearchItemSchema>;
export type WebResearchBundle = z.infer<typeof WebResearchBundleSchema>;
export type IngestWebResearchInput = z.infer<typeof IngestWebResearchInputSchema>;
