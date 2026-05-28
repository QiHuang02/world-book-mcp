import { z } from "zod";

export const PlanItemStatusSchema = z.enum(["pending", "in_progress", "blocked", "done", "skipped"]);
export const PlanItemCategorySchema = z.enum(["requirements", "worldbook", "character_card", "mvu", "html", "regex", "ejs", "build", "delivery", "review", "other"]);

export const PlanItemTargetSchema = z.object({
  draftType: z.enum(["entry", "mvu", "html", "regex", "ejs"]).optional(),
  sliceId: z.string().optional(),
  tool: z.string().optional(),
}).default({});

export const PlanItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: PlanItemStatusSchema.default("pending"),
  category: PlanItemCategorySchema.default("other"),
  description: z.string().optional(),
  target: PlanItemTargetSchema.optional(),
  dependsOn: z.array(z.string()).default([]),
  acceptance: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export const PlanSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  next_open_item_id: z.string().optional(),
});

export type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>;
export type PlanItemCategory = z.infer<typeof PlanItemCategorySchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type PlanSummary = z.infer<typeof PlanSummarySchema>;

export function summarizePlanItems(items: PlanItem[]): PlanSummary {
  const counts = { pending: 0, in_progress: 0, blocked: 0, done: 0, skipped: 0 };
  for (const item of items) counts[item.status] += 1;
  const next = items.find((item) => item.status === "in_progress") ?? items.find((item) => item.status === "pending") ?? items.find((item) => item.status === "blocked");
  return { total: items.length, ...counts, next_open_item_id: next?.id };
}
