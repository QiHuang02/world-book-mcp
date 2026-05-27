import { z } from "zod";

export const BuildAssetsInputSchema = z.object({
  project_id: z.string(),
  target: z.enum(["mvu", "html", "regex", "ejs", "all"]).default("all"),
  include_previews: z.boolean().optional(),
  mode: z.literal("full").default("full"),
  strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional(),
  force: z.boolean().default(false),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export const ValidateProjectInputSchema = z.object({
  project_id: z.string(),
  scope: z.enum(["all", "project", "plan", "worldbook", "character_card", "opening", "mvu", "html", "regex", "ejs", "assets", "build", "delivery", "content"]).default("all"),
  build_id: z.string().optional(),
  build_policy: z.enum(["ignore", "warn", "require_fresh"]).optional(),
  strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional(),
  include_diagnostics: z.boolean().default(false),
});

export const GenerateJsonInputSchema = z.object({
  project_id: z.string(),
  target: z.enum(["worldbook", "character_card", "both"]).optional(),
  build_id: z.string().optional(),
  rebuild: z.enum(["always", "auto", "never"]).optional(),
  output_path: z.string().optional(),
  output_paths: z.object({ worldbook: z.string().optional(), character_card: z.string().optional() }).optional(),
  overwrite: z.boolean().default(false),
  strict_review: z.union([z.boolean(), z.enum(["off", "standard", "strict"])]).optional(),
  force: z.boolean().default(false),
});

export const QueryJsonInputSchema = z.object({
  path: z.string().min(1),
  mode: z.enum(["summary", "worldbook_entries", "greetings", "search", "uid", "stats"]),
  query: z.string().optional(),
  uid: z.number().int().optional(),
});

