import { z } from "zod";
import { DraftTypeSchema, SliceOriginSchema } from "../schemas/draft-slice.js";
import { EjsEntryConfigSchema } from "../schemas/ejs.js";
import { HtmlBeautifyConfigSchema } from "../schemas/html-beautify.js";
import { MvuConfigSchema } from "../schemas/mvu.js";
import { WorldbookDraftEntrySchema } from "../schemas/worldbook-draft.js";

export const CreateDraftSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1).optional(),
  title: z.string().optional(),
  active: z.boolean().default(true),
  source: z.enum(["manual", "imported", "generated", "shared"]).default("manual"),
  origin: SliceOriginSchema.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  data: z.unknown().optional(),
  preset: z.string().optional(),
  if_exists: z.enum(["error", "overwrite"]).default("error"),
  expected_workspace_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const UpdateSliceMetadataInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
  changes: z.object({
    title: z.string().optional(),
    active: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateEntryContentInputSchema = z.object({
  project_id: z.string(),
  id: z.string().min(1),
  content: z.string(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateEntryConfigInputSchema = z.object({
  project_id: z.string(),
  id: z.string().min(1),
  changes: z.object({
    comment: z.string().min(1).optional(),
    entryType: WorldbookDraftEntrySchema.shape.entryType.optional(),
    keys: z.array(z.string()).optional(),
    secondaryKeys: z.array(z.string()).optional(),
    characterName: z.string().nullable().optional(),
    constant: z.boolean().optional(),
    position: WorldbookDraftEntrySchema.shape.position.optional(),
    order: z.number().optional(),
    enabled: z.boolean().optional(),
    depth: z.number().int().min(0).nullable().optional(),
    scanDepth: z.number().int().min(0).nullable().optional(),
    preventRecursion: z.boolean().optional(),
    excludeRecursion: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateHtmlStatusbarInputSchema = z.object({
  project_id: z.string(),
  html: z.string().optional(),
  scopedCss: z.string().nullable().optional(),
  variablePaths: z.array(z.string()).optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateHtmlConfigInputSchema = z.object({
  project_id: z.string(),
  changes: z.object({
    target: HtmlBeautifyConfigSchema.shape.target.optional(),
    theme: HtmlBeautifyConfigSchema.shape.theme.optional(),
    hideRegex: z.boolean().optional(),
    regexPolicy: z.object({ generateHideRegex: z.boolean().optional(), generateStatusbarRegex: z.boolean().optional() }).optional(),
  }).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateEjsContentInputSchema = z.object({
  project_id: z.string(),
  id: z.string(),
  content: z.string(),
  variablePaths: z.array(z.string()).optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const UpdateEjsConfigInputSchema = z.object({
  project_id: z.string(),
  id: z.string(),
  changes: EjsEntryConfigSchema.omit({ content: true }).partial().extend({ depth: z.number().int().nullable().optional(), scanDepth: z.number().int().nullable().optional() }).refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" }),
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

export const ListDraftSlicesInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema.optional(),
  include_content: z.boolean().default(false),
});

export const GetDraftSliceInputSchema = z.object({
  project_id: z.string(),
  draft_type: DraftTypeSchema,
  id: z.string().min(1),
});

export const DeleteDraftSliceInputSchema = GetDraftSliceInputSchema.extend({
  expected_project_revision: z.number().int().nonnegative().optional(),
  expected_slice_revision: z.number().int().nonnegative().optional(),
});

