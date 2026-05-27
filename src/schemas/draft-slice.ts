import { z } from "zod";
import { EjsEntryConfigSchema } from "./ejs.js";
import { HtmlBeautifyConfigSchema } from "./html-beautify.js";
import { MvuConfigSchema } from "./mvu.js";
import { RegexSliceDataSchema } from "./regex.js";
import { WorldbookDraftEntrySchema } from "./worldbook-draft.js";

export const DraftTypeSchema = z.enum(["entry", "mvu", "html", "regex", "ejs"]);

export const ImportedSliceOriginSchema = z.object({
  kind: z.literal("imported"),
  importId: z.string().min(1),
  sourcePath: z.string(),
  sourceFormat: z.enum(["worldbook", "character_card"]),
  importedAt: z.string(),
  pointer: z.string().optional(),
  uid: z.number().int().optional(),
  entryIndex: z.number().int().nonnegative().optional(),
  scriptName: z.string().optional(),
  scriptIndex: z.number().int().nonnegative().optional(),
  regexSource: z.enum(["third_party", "mvu", "html", "unknown"]).optional(),
});

export const GeneratedSliceOriginSchema = z.object({
  kind: z.literal("generated"),
  generator: z.enum(["template", "mvu_template", "html_template", "regex_template", "ejs_template", "import_template"]),
  generatedAt: z.string(),
  sourceSliceIds: z.array(z.string()).optional(),
});

export const SharedSliceOriginSchema = z.object({
  kind: z.literal("shared"),
  sharedId: z.string().min(1),
  sourceProject: z.string().optional(),
  sourceSliceId: z.string().optional(),
  usedAt: z.string(),
});

export const SliceOriginSchema = z.discriminatedUnion("kind", [ImportedSliceOriginSchema, GeneratedSliceOriginSchema, SharedSliceOriginSchema]);

export const DraftSliceDataSchemas = {
  entry: WorldbookDraftEntrySchema,
  mvu: MvuConfigSchema,
  html: HtmlBeautifyConfigSchema,
  regex: RegexSliceDataSchema,
  ejs: EjsEntryConfigSchema,
} satisfies Record<z.infer<typeof DraftTypeSchema>, z.ZodTypeAny>;

export const DraftSliceSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  type: DraftTypeSchema,
  title: z.string().optional(),
  active: z.boolean().default(true),
  source: z.enum(["manual", "imported", "generated", "shared"]).default("manual"),
  origin: SliceOriginSchema.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  data: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative().default(0),
}).superRefine((slice, context) => {
  const schema = DraftSliceDataSchemas[slice.type];
  const parsed = schema.safeParse(slice.data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ["data", ...issue.path] });
  }
  if (slice.source === "imported" && slice.origin?.kind !== "imported") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["origin"], message: "source=imported 时必须提供 imported origin" });
  }
});

export type DraftType = z.infer<typeof DraftTypeSchema>;
export type SliceOrigin = z.infer<typeof SliceOriginSchema>;
export type DraftSliceDataSchemasByType = { [K in DraftType]: z.infer<(typeof DraftSliceDataSchemas)[K]> };
export type DraftSlice = z.infer<typeof DraftSliceSchema>;
