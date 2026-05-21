import { z } from "zod";

export const SourceTypeSchema = z.enum(["plain_text", "novel", "web_summary", "wiki", "notes"]);

export const SourceDocumentSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  sourceType: SourceTypeSchema,
  content: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export const IngestTextSourceInputSchema = z.object({
  project_id: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  source_type: SourceTypeSchema.default("plain_text"),
  source_url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type IngestTextSourceInput = z.infer<typeof IngestTextSourceInputSchema>;
