import { z } from "zod";
import { WorldbookDraftEntrySchema, PositionNameSchema } from "./worldbook-draft.js";

export const PatchMatchSchema = z.object({
  uid: z.number().int().min(0).optional(),
  index: z.number().int().min(0).optional(),
  comment: z.string().optional(),
}).refine((value) => value.uid !== undefined || value.index !== undefined || value.comment, {
  message: "必须提供 uid、index 或 comment 用于定位条目",
});

export const PatchChangesSchema = z.object({
  comment: z.string().optional(),
  content: z.string().optional(),
  keys: z.array(z.string()).optional(),
  secondaryKeys: z.array(z.string()).optional(),
  constant: z.boolean().optional(),
  position: PositionNameSchema.optional(),
  order: z.number().optional(),
  enabled: z.boolean().optional(),
  depth: z.number().int().min(0).optional(),
  scanDepth: z.number().int().min(0).nullable().optional(),
});

export const AddEntryOperationSchema = z.object({
  op: z.literal("add_entry"),
  entry: WorldbookDraftEntrySchema,
});

export const UpdateEntryOperationSchema = z.object({
  op: z.literal("update_entry"),
  match: PatchMatchSchema,
  changes: PatchChangesSchema,
});

export const DeleteEntryOperationSchema = z.object({
  op: z.literal("delete_entry"),
  match: PatchMatchSchema,
});

export const ReorderEntryOperationSchema = z.object({
  op: z.literal("reorder_entry"),
  match: PatchMatchSchema,
  order: z.number(),
});

export const ToggleEntryOperationSchema = z.object({
  op: z.literal("toggle_entry"),
  match: PatchMatchSchema,
  enabled: z.boolean(),
});

export const WorldbookPatchOperationSchema = z.discriminatedUnion("op", [
  AddEntryOperationSchema,
  UpdateEntryOperationSchema,
  DeleteEntryOperationSchema,
  ReorderEntryOperationSchema,
  ToggleEntryOperationSchema,
]);

export const WorldbookPatchSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourcePath: z.string().optional(),
  operations: z.array(WorldbookPatchOperationSchema).min(1),
  createdAt: z.string(),
});

export const ImportWorldbookJsonInputSchema = z.object({
  path: z.string().min(1),
  project_name: z.string().optional(),
  project_id: z.string().optional(),
  if_exists: z.enum(["error", "return_existing", "overwrite"]).default("return_existing"),
});

export const CreateWorldbookPatchInputSchema = z.object({
  project_id: z.string(),
  operations: z.array(WorldbookPatchOperationSchema).min(1),
});

export const PreviewWorldbookPatchInputSchema = z.object({
  project_id: z.string(),
  patch_id: z.string(),
});

export const ApplyWorldbookPatchInputSchema = z.object({
  project_id: z.string(),
  patch_id: z.string(),
  output_path: z.string().optional(),
  backup: z.boolean().default(true),
  overwrite: z.boolean().default(false),
});

export type PatchMatch = z.infer<typeof PatchMatchSchema>;
export type PatchChanges = z.infer<typeof PatchChangesSchema>;
export type WorldbookPatchOperation = z.infer<typeof WorldbookPatchOperationSchema>;
export type WorldbookPatch = z.infer<typeof WorldbookPatchSchema>;
