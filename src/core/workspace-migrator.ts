import fs from "node:fs/promises";
import path from "node:path";
import { CharacterCardConfigSchema } from "../schemas/character-card.js";
import { DraftSliceDataSchemas, DraftSliceSchema, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { WorkspaceSchema } from "../schemas/workspace.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { ROOT_DIR, sanitizeFilename } from "../storage/path-policy.js";

const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
const OLD_PROJECT_PATH = path.resolve(WORKSPACE_DIR, "project.json");
const WORKSPACE_JSON_PATH = path.resolve(WORKSPACE_DIR, "workspace.json");
const OLD_DRAFT_DIR = path.resolve(WORKSPACE_DIR, "draft");
const OLD_PLAN_PATH = path.resolve(WORKSPACE_DIR, "plan.md");

export interface WorkspaceMigrationResult {
  migrated: boolean;
  slug?: string;
  project_json?: string;
  workspace_json?: string;
  converted_slices?: number;
}

export async function migrateLegacyWorkspaceIfNeeded(): Promise<WorkspaceMigrationResult> {
  if (await exists(WORKSPACE_JSON_PATH)) return { migrated: false };
  if (!await exists(OLD_PROJECT_PATH)) return { migrated: false };

  const legacyProject = await readJsonFile(OLD_PROJECT_PATH, ProjectSchema);
  const slug = uniqueSlug(resolveSlug(legacyProject.name));
  const projectDir = path.resolve(WORKSPACE_DIR, "projects", slug);
  const slicesDir = path.resolve(projectDir, "slices");
  const entriesDir = path.resolve(slicesDir, "entries");
  const assetsDir = path.resolve(slicesDir, "assets");
  await fs.mkdir(entriesDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });

  const { project, convertedSlices } = await convertProjectAndSlices(legacyProject, { entriesDir, assetsDir });
  const nextProject = ProjectSchema.parse({ ...project, slug, updatedAt: nowIso() });
  await writeJsonFile(path.resolve(projectDir, "project.json"), nextProject);

  if (await exists(OLD_PLAN_PATH)) await fs.rename(OLD_PLAN_PATH, path.resolve(projectDir, "plan.md"));
  else await fs.writeFile(path.resolve(projectDir, "plan.md"), "# World Book MCP Plan\n", "utf8");

  await writeJsonFile(WORKSPACE_JSON_PATH, WorkspaceSchema.parse({
    version: 2,
    default_project: slug,
    projects: [{ slug, name: nextProject.name, output_type: nextProject.output_type ?? nextProject.plan.output_target ?? "worldbook" }],
  }));

  await fs.rm(OLD_DRAFT_DIR, { recursive: true, force: true });
  await fs.rm(OLD_PROJECT_PATH, { force: true });

  return { migrated: true, slug, project_json: path.resolve(projectDir, "project.json"), workspace_json: WORKSPACE_JSON_PATH, converted_slices: convertedSlices };
}

async function convertProjectAndSlices(project: Project, dirs: { entriesDir: string; assetsDir: string }): Promise<{ project: Project; convertedSlices: number }> {
  let next: Project = { ...project };
  let convertedSlices = 0;

  const worldbookSlices = await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "worldbook"));
  for (const slice of worldbookSlices.filter((slice) => slice.type === "worldbook_entry")) {
    await writeConvertedSlice(dirs.entriesDir, { ...baseSlice(slice), type: "entry", data: DraftSliceDataSchemas.entry.parse(slice.data) });
    convertedSlices += 1;
  }

  const cardSlices = await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "character-card"));
  const profile = lastSlice(cardSlices, "character_profile");
  const greetings = lastSlice(cardSlices, "character_greetings");
  if (profile) {
    const parsed = profile.data as Record<string, unknown>;
    next.profile = {
      ...CharacterCardConfigSchema.shape.card.parse(parsed),
      include_worldbook: parsed.include_worldbook !== false,
      worldbook_name: typeof parsed.worldbook_name === "string" ? parsed.worldbook_name : undefined,
    };
  }
  if (greetings) next.greetings = { first_mes: String((greetings.data as Record<string, unknown>).first_mes ?? ""), alternate_greetings: Array.isArray((greetings.data as Record<string, unknown>).alternate_greetings) ? (greetings.data as Record<string, unknown>).alternate_greetings as string[] : [] };

  const mvuSlices = await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "mvu"));
  const mvuSchema = lastSlice(mvuSlices, "mvu_schema");
  const mvuRules = lastSlice(mvuSlices, "mvu_update_rules");
  if (mvuSchema || mvuRules) {
    const data = DraftSliceDataSchemas.mvu.parse({ ...(mvuSchema?.data as object | undefined), ...(mvuRules?.data as object | undefined) });
    await writeConvertedSlice(dirs.assetsDir, { id: "mvu", type: "mvu", title: "MVU 变量系统", enabled: (mvuSchema?.enabled ?? mvuRules?.enabled) ?? true, data, createdAt: mvuSchema?.createdAt ?? mvuRules?.createdAt ?? nowIso(), updatedAt: nowIso(), revision: 0 });
    convertedSlices += 1;
  }

  const htmlSlices = await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "html"));
  const statusbar = lastSlice(htmlSlices, "html_statusbar");
  const regexes = htmlSlices.filter((slice) => slice.type === "html_regex" && slice.enabled).map((slice) => stripSource(slice.data as Record<string, unknown>));
  if (statusbar || regexes.length > 0) {
    const statusData = statusbar?.data as Record<string, unknown> | undefined;
    const data = DraftSliceDataSchemas.html.parse({
      enabled: statusData?.enabled ?? true,
      target: statusData?.target ?? (statusbar ? "statusbar" : "global"),
      theme: statusData?.theme ?? "minimal",
      statusbar: { enabled: statusData?.enabled ?? Boolean(statusbar), html: statusData?.html ?? "", hide_regex: statusData?.hide_regex ?? true },
      global: { enabled: regexes.length > 0, regex_scripts: regexes },
    });
    await writeConvertedSlice(dirs.assetsDir, { id: "html", type: "html", title: "HTML 状态栏美化", enabled: statusbar?.enabled ?? true, data, createdAt: statusbar?.createdAt ?? nowIso(), updatedAt: nowIso(), revision: 0 });
    convertedSlices += 1;
  }

  const ejsSlices = await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "ejs"));
  for (const slice of ejsSlices.filter((slice) => slice.type === "ejs_entry")) {
    await writeConvertedSlice(dirs.assetsDir, { ...baseSlice(slice), type: "ejs", data: DraftSliceDataSchemas.ejs.parse(slice.data) });
    convertedSlices += 1;
  }

  const style = lastSlice(await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "style")), "style_profile");
  if (style) next.style = next.styleProfile = style.data as Project["style"];
  const chapter = lastSlice(await readLegacySlices(path.resolve(OLD_DRAFT_DIR, "chapter")), "chapter_outline");
  if (chapter) next.chapters = next.chapterOutline = chapter.data as Project["chapters"];

  delete next.draft;
  return { project: next, convertedSlices };
}

async function readLegacySlices(dir: string): Promise<Array<Record<string, unknown> & { id: string; type: string; enabled: boolean; data: unknown; createdAt?: string; updatedAt?: string; title?: string }>> {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const slices = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    slices.push(await readJsonFile(path.resolve(dir, file)) as Record<string, unknown> & { id: string; type: string; enabled: boolean; data: unknown; createdAt?: string; updatedAt?: string; title?: string });
  }
  return slices;
}

function baseSlice(slice: { id: string; title?: string; enabled: boolean; createdAt?: string }): Pick<DraftSlice, "id" | "title" | "enabled" | "createdAt" | "updatedAt" | "revision"> {
  return { id: slice.id, title: slice.title, enabled: slice.enabled, createdAt: slice.createdAt ?? nowIso(), updatedAt: nowIso(), revision: 0 };
}

async function writeConvertedSlice(dir: string, slice: DraftSlice): Promise<void> {
  const parsed = DraftSliceSchema.parse(slice);
  await writeJsonFile(path.resolve(dir, `${sanitizeFilename(parsed.id)}.json`), parsed);
}

function lastSlice(slices: Array<{ type: string; updatedAt?: string }>, type: string) {
  return slices.filter((slice) => slice.type === type).sort((a, b) => String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""))).at(-1) as (Record<string, unknown> & { id: string; type: string; enabled: boolean; data: unknown; createdAt?: string; updatedAt?: string; title?: string }) | undefined;
}

function stripSource(value: Record<string, unknown>): Record<string, unknown> {
  const { source: _source, ...rest } = value;
  return rest;
}

async function exists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function resolveSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || sanitizeFilename(name);
}

function uniqueSlug(slug: string): string {
  // 迁移只在 workspace.json 不存在时运行，通常不会冲突；保留函数便于以后扩展。
  return slug;
}
