import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { createId, nowIso } from "../utils/ids.js";
import { readJsonFile, toPrettyJson, writeJsonFile } from "../utils/json.js";
import { assertInside, ROOT_DIR, sanitizeFilename, writeTextFileSafely } from "./path-policy.js";
import { ensureDraftDirs } from "./draft-store.js";
import { ensureLogDir, LATEST_LOG_PATH, currentSessionId } from "./tool-log.js";
import { ensurePlanFile, PLAN_PATH } from "./plan-store.js";

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
    return { project: existing, created: false, workspace: workspacePaths() };
  }

  if (existing && ifExists === "overwrite") {
    await clearWorkspaceData();
  }

  await ensureWorkspaceDirs();
  const timestamp = nowIso();
  const project: Project = {
    id: input.projectId ?? createId("project"),
    name: input.name,
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    plan: { enabled_assets: {} },
    imports: [],
    logs: { session_id: currentSessionId(), latest_log_path: LATEST_LOG_PATH },
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
  return project;
}

export async function writeWorkspaceProject(project: Project): Promise<void> {
  await ensureWorkspaceDirs();
  const { draft: _draft, ...metadata } = project;
  await writeJsonFile(WORKSPACE_PROJECT_PATH, metadata);
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
    const filePath = path.resolve(ROOT_DIR, file.name);
    try {
      // 不再维护"已知项目配置 JSON"的黑名单（package.json/tsconfig.json/...）；
      // 直接交给 isTavernJson 做正向识别。结构上不像酒馆 JSON 的文件会被忽略，
      // 解析失败的 JSON 也只是落入 catch 分支，IO 成本可以接受。
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
    plan_md: PLAN_PATH,
    logs_dir: path.dirname(LATEST_LOG_PATH),
    latest_log: LATEST_LOG_PATH,
  };
}

export interface WorkspacePaths {
  workspace_dir: string;
  project_json: string;
  draft_dir: string;
  plan_md: string;
  logs_dir: string;
  latest_log: string;
}

export async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_DRAFT_DIR, { recursive: true });
  await ensureDraftDirs();
  await ensurePlanFile();
  await ensureLogDir();
}

async function clearWorkspaceData(): Promise<void> {
  await fs.rm(WORKSPACE_DRAFT_DIR, { recursive: true, force: true });
  await fs.rm(PLAN_PATH, { force: true }).catch(() => undefined);
  await ensureDraftDirs();
}

export async function loadWorkspaceProjectIfExists(): Promise<Project | undefined> {
  try {
    const project = await readJsonFile(WORKSPACE_PROJECT_PATH, ProjectSchema);
    const { draft: _legacyDraft, ...metadata } = project;
    return metadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
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
