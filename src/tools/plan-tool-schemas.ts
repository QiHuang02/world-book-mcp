import { z } from "zod";
import { DecisionOptionSchema } from "../schemas/decision.js";

export const UpdatePlanInputSchema = z.object({
  project_id: z.string(),
  mode: z.enum(["replace_section", "append_decision", "append_note", "set_export_target", "rewrite", "request_decision", "record_decision", "list_decisions", "clear_decision"]),
  section: z.string().optional(),
  content: z.string().optional(),
  decision: z.object({ question: z.string(), answer: z.string(), rationale: z.string().optional() }).optional(),
  export_target: z.object({ type: z.enum(["worldbook", "character_card", "both"]), filename: z.string().optional(), strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional() }).optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  decision_request: z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    context: z.string().optional(),
    source_tool: z.string().optional(),
    options: z.array(DecisionOptionSchema).optional(),
    allow_custom: z.boolean().optional(),
    multiple: z.boolean().optional(),
    default_value: z.string().optional(),
  }).optional(),
  decision_record: z.object({
    id: z.string().min(1),
    selected_values: z.array(z.string()).default([]),
    custom_text: z.string().optional(),
    append_to_plan: z.boolean().default(true),
  }).optional(),
  decision_filter: z.object({ only_pending: z.boolean().optional(), only_recorded: z.boolean().optional() }).optional(),
  decision_id: z.string().optional(),
});
