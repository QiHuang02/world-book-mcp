import { z } from "zod";

export const DecisionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  is_recommended: z.boolean().optional(),
});

export const PendingDecisionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
  source_tool: z.string().optional(),
  options: z.array(DecisionOptionSchema).default([]),
  allow_custom: z.boolean().default(true),
  multiple: z.boolean().default(false),
  default_value: z.string().optional(),
  created_at: z.string(),
});

export const RecordedDecisionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  selected_values: z.array(z.string()).default([]),
  custom_text: z.string().optional(),
  source_tool: z.string().optional(),
  recorded_at: z.string(),
});

export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type PendingDecision = z.infer<typeof PendingDecisionSchema>;
export type RecordedDecision = z.infer<typeof RecordedDecisionSchema>;

export const SuggestedDecisionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
  source_tool: z.string().optional(),
  options: z.array(DecisionOptionSchema).default([]),
  allow_custom: z.boolean().default(true),
  multiple: z.boolean().default(false),
  default_value: z.string().optional(),
});

export type SuggestedDecision = z.infer<typeof SuggestedDecisionSchema>;
