import { z } from "zod";
import { OpeningDesignSchema } from "../schemas/project.js";

export const InitProjectInputSchema = z.object({
  name: z.string().min(1),
  output: z.enum(["worldbook", "character_card", "both"]),
  source: z.enum(["original", "derivative", "modify_existing", "composite"]),
  assets: z.object({ mvu: z.boolean().optional(), html: z.boolean().optional(), regex: z.boolean().optional(), ejs: z.boolean().optional() }).optional(),
  opening: OpeningDesignSchema.optional(),
  project_id: z.string().optional(),
  if_exists: z.enum(["error", "overwrite"]).default("error"),
  scan_existing: z.boolean().optional(),
  import_strategy: z.enum(["auto", "ask", "none"]).optional(),
}).superRefine((value, context) => {
  if ((value.output === "character_card" || value.output === "both") && !value.opening) context.addIssue({ code: z.ZodIssueCode.custom, path: ["opening"], message: "output 包含 character_card 时 opening 必填" });
  if (value.assets?.ejs && !value.assets?.mvu) context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", "ejs"], message: "EJS 依赖 MVU，请同时启用 assets.mvu" });
  if (value.source === "modify_existing" && value.import_strategy === "none") context.addIssue({ code: z.ZodIssueCode.custom, path: ["import_strategy"], message: "source=modify_existing 不允许 import_strategy=none" });
});

export const ImportExistingJsonInputSchema = z.object({
  project_id: z.string(),
  path: z.string().optional(),
  include: z.object({ entries: z.boolean().optional(), character_profile: z.boolean().optional(), greetings: z.boolean().optional(), mvu: z.boolean().optional(), html: z.boolean().optional(), regex: z.boolean().optional(), ejs: z.boolean().optional() }).optional(),
  if_exists: z.enum(["error", "overwrite", "rename"]).default("rename"),
  set_as_import_target: z.boolean().default(true),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const GetProjectInputSchema = z.object({
  project_id: z.string(),
  include_content: z.boolean().default(false),
});
