import { z } from "zod";

export const StyleProfileSchema = z.object({
  narrative_perspective: z.enum(["first_person", "second_person", "third_person_limited", "third_person_omniscient", "mixed"]).default("third_person_limited"),
  tense: z.enum(["past", "present", "mixed"]).default("present"),
  sentence_length: z.enum(["short", "medium", "long", "varied"]).default("varied"),
  dialogue_ratio: z.enum(["low", "medium", "high"]).default("medium"),
  description_focus: z.array(z.string()).default([]),
  rhythm: z.string().default(""),
  signature_techniques: z.array(z.string()).default([]),
  forbidden_terms: z.array(z.string()).default([]),
  forbidden_patterns: z.array(z.string()).default([]),
  positive_rules: z.array(z.string()).default([]),
  negative_rules: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;
