import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { WorldbookDraftEntrySchema, type WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createId, nowIso } from "../utils/ids.js";
import { readJsonFile, toPrettyJson, writeJsonFile } from "../utils/json.js";
import { assertInside, ROOT_DIR, sanitizeFilename, writeTextFileSafely } from "./path-policy.js";

export const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
export const WORKSPACE_PROJECT_PATH = path.resolve(WORKSPACE_DIR, "project.json");
export const WORKSPACE_DRAFT_DIR = path.resolve(WORKSPACE_DIR, "draft");

export type InitWorkspaceIfExists = "error" | "return_existing" | "overwrite";
export type InitProjectKind = "worldbook" | "character_card" | "mixed";

export interface RootTemplateResult {
  created: boolean;
  reason: "created" | "existing_tavern_json";
  path?: string;
  existing_files?: string[];
}

export async function initWorkspaceProject(input: { name: string; projectId?: string; ifExists?: InitWorkspaceIfExists }): Promise<{ project: Project; created: boolean; workspace: WorkspacePaths }> {
  const ifExists = input.ifExists ?? "error";
  const existing = await loadWorkspaceProjectIfExists();
  if (existing && ifExists === "error") {
    throw new Error(".worldbook/project.json 已存在；如需复用请设置 if_exists=return_existing，如需重建请设置 if_exists=overwrite");
  }
  if (existing && ifExists === "return_existing") {
    await ensureWorkspaceDirs();
    return { project: await attachWorkspaceDraft(existing), created: false, workspace: workspacePaths() };
  }

  if (existing && ifExists === "overwrite") {
    await clearWorkspaceDraftEntries();
  }

  await ensureWorkspaceDirs();
  const timestamp = nowIso();
  const project: Project = {
    id: input.projectId ?? createId("project"),
    name: input.name,
    patches: [],
    characterCardPatches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await writeWorkspaceProject(project);
  return { project, created: true, workspace: workspacePaths() };
}

export async function isWorkspaceProject(projectId: string): Promise<boolean> {
  const project = await loadWorkspaceProjectIfExists();
  return project?.id === projectId;
}

export async function loadWorkspaceProjectIfMatches(projectId: string): Promise<Project | undefined> {
  const project = await loadWorkspaceProjectIfExists();
  if (!project || project.id !== projectId) return undefined;
  return attachWorkspaceDraft(project);
}

export async function writeWorkspaceProject(project: Project): Promise<void> {
  await ensureWorkspaceDirs();
  const { draft: _draft, ...metadata } = project;
  await writeJsonFile(WORKSPACE_PROJECT_PATH, metadata);
  if (project.draft) await writeWorkspaceDraftEntries(project.draft);
}

export async function readWorkspaceDraftEntries(): Promise<WorldbookDraftEntry[] | undefined> {
  try {
    const files = (await fs.readdir(WORKSPACE_DRAFT_DIR))
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    if (files.length === 0) return undefined;
    const entries: WorldbookDraftEntry[] = [];
    for (const file of files) {
      entries.push(await readJsonFile(path.join(WORKSPACE_DRAFT_DIR, file), WorldbookDraftEntrySchema));
    }
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeWorkspaceDraftEntry(entry: WorldbookDraftEntry): Promise<string> {
  await ensureWorkspaceDirs();
  const outputPath = draftEntryPath(entry.comment);
  await writeJsonFile(outputPath, entry);
  return outputPath;
}

export async function deleteWorkspaceDraftEntry(comment: string): Promise<string> {
  const outputPath = draftEntryPath(comment);
  await fs.unlink(outputPath);
  return outputPath;
}

export async function writeWorkspaceDraftEntries(entries: WorldbookDraftEntry[]): Promise<void> {
  await ensureWorkspaceDirs();
  const keep = new Set<string>();
  for (const entry of entries) {
    const outputPath = await writeWorkspaceDraftEntry(entry);
    keep.add(path.basename(outputPath));
  }
  const files = await fs.readdir(WORKSPACE_DRAFT_DIR).catch(() => [] as string[]);
  for (const file of files) {
    if (file.endsWith(".json") && !keep.has(file)) {
      await fs.unlink(path.join(WORKSPACE_DRAFT_DIR, file));
    }
  }
}

export function draftEntryPath(comment: string): string {
  const filename = `${sanitizeFilename(comment)}.json`;
  return assertInside(WORKSPACE_DRAFT_DIR, path.resolve(WORKSPACE_DRAFT_DIR, filename));
}

export async function ensureRootTemplateJson(input: { name: string; kind?: InitProjectKind }): Promise<RootTemplateResult> {
  let existingFiles = await findRootTavernJsonFiles();
  if (existingFiles.length > 0) {
    return { created: false, reason: "existing_tavern_json", existing_files: existingFiles };
  }

  const kind = input.kind ?? "worldbook";
  const template = kind === "worldbook" ? worldbookTemplate(input.name) : characterCardTemplate(input.name);
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const filename = await nextAvailableRootTemplateFilename(input.name);
    const outputPath = assertInside(ROOT_DIR, path.resolve(ROOT_DIR, filename));
    try {
      await writeTextFileSafely(outputPath, toPrettyJson(template), { overwrite: false });
      return { created: true, reason: "created", path: outputPath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      existingFiles = await findRootTavernJsonFiles();
      if (existingFiles.length > 0) return { created: false, reason: "existing_tavern_json", existing_files: existingFiles };
    }
  }
  throw new Error("无法找到可用的模板文件名");
}

export async function findRootTavernJsonFiles(): Promise<string[]> {
  const files = await fs.readdir(ROOT_DIR, { withFileTypes: true });
  const result: string[] = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;
    if (isCommonProjectJson(file.name)) continue;
    const filePath = path.resolve(ROOT_DIR, file.name);
    try {
      const parsed = await readJsonFile(filePath);
      if (isTavernJson(parsed)) result.push(filePath);
    } catch {
      // 忽略无效 JSON 或无法读取的文件
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

export function workspacePaths(): WorkspacePaths {
  return {
    workspace_dir: WORKSPACE_DIR,
    project_json: WORKSPACE_PROJECT_PATH,
    draft_dir: WORKSPACE_DRAFT_DIR,
  };
}

export interface WorkspacePaths {
  workspace_dir: string;
  project_json: string;
  draft_dir: string;
}

export async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_DRAFT_DIR, { recursive: true });
}

async function clearWorkspaceDraftEntries(): Promise<void> {
  await fs.rm(WORKSPACE_DRAFT_DIR, { recursive: true, force: true });
}

export async function loadWorkspaceProjectIfExists(): Promise<Project | undefined> {
  try {
    return await readJsonFile(WORKSPACE_PROJECT_PATH, ProjectSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function attachWorkspaceDraft(project: Project): Promise<Project> {
  const draft = await readWorkspaceDraftEntries();
  const { draft: _ignoredLegacyDraft, ...metadata } = project;
  return draft ? { ...metadata, draft } : metadata;
}

async function nextAvailableRootTemplateFilename(name: string): Promise<string> {
  const safeName = sanitizeFilename(name);
  const candidates = [`${safeName}.json`, `${safeName}.template.json`];
  for (const candidate of candidates) {
    if (!await rootFileExists(candidate)) return candidate;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${safeName}.template-${index}.json`;
    if (!await rootFileExists(candidate)) return candidate;
  }
  throw new Error("无法找到可用的模板文件名");
}

async function rootFileExists(filename: string): Promise<boolean> {
  try {
    await fs.access(path.resolve(ROOT_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

function isCommonProjectJson(filename: string): boolean {
  return filename === "package.json" || filename === "package-lock.json" || filename === "tsconfig.json" || filename === "jsconfig.json";
}

function isTavernJson(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.spec === "chara_card_v3") return true;
  const data = record.data;
  if (data && typeof data === "object") {
    const characterBook = (data as Record<string, unknown>).character_book;
    if (characterBook && typeof characterBook === "object" && Array.isArray((characterBook as Record<string, unknown>).entries)) return true;
  }
  return isWorldbookJson(record);
}

function isWorldbookJson(record: Record<string, unknown>): boolean {
  if (!record.entries || typeof record.entries !== "object" || Array.isArray(record.entries)) return false;
  if (typeof record.name === "string") return true;
  const entries = record.entries as Record<string, unknown>;
  const values = Object.values(entries);
  if (values.length === 0) return true;
  return values.some(isWorldbookEntryLike);
}

function isWorldbookEntryLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.comment === "string" || typeof entry.content === "string" || Array.isArray(entry.key) || typeof entry.position === "number";
}

function worldbookTemplate(name: string): unknown {
  return {
    name,
    entries: {},
  };
}

function characterCardTemplate(name: string): unknown {
  return {
    name,
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    creatorcomment: "",
    avatar: "none",
    talkativeness: "0.5",
    fav: false,
    tags: [],
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name,
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      creator: "",
      character_version: "1.0",
      alternate_greetings: [],
      group_only_greetings: [],
      extensions: {
        talkativeness: "0.5",
        fav: false,
        world: name,
        depth_prompt: { prompt: "", depth: 4, role: "system" },
      },
      character_book: {
        name: `${name}世界书`,
        entries: [],
      },
    },
    create_date: new Date().toISOString(),
  };
}
