import fs from "node:fs/promises";
import path from "node:path";
import { migrateLegacyWorkspaceIfNeeded } from "../core/workspace-migrator.js";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { WorkspaceSchema, type Workspace, type WorkspaceProjectEntry } from "../schemas/workspace.js";
import { createId, nowIso } from "../utils/ids.js";
import { readJsonFile, toPrettyJson, writeJsonFile } from "../utils/json.js";
import { assertInside, ROOT_DIR, sanitizeFilename, writeTextFileSafely } from "./path-policy.js";
import { ensureDraftDirs } from "./draft-store.js";
import { ensureLogDir, LATEST_LOG_PATH, currentSessionId } from "./tool-log.js";

export const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
export const WORKSPACE_JSON_PATH = path.resolve(WORKSPACE_DIR, "workspace.json");
const PROJECTS_DIR = path.resolve(WORKSPACE_DIR, "projects");

// ─── slug 工具 ───────────────────────────────────────────────────────────────

export function resolveProjectSlug(name: string): string {
  // 中文/特殊字符 → 下划线，保留字母数字和连字符
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // 如果全是中文/非 ASCII，用 sanitizeFilename 兜底
  return base || sanitizeFilename(name);
}

// ─── 路径工具 ─────────────────────────────────────────────────────────────────

export function projectDir(slug: string): string {
  return assertInside(PROJECTS_DIR, path.resolve(PROJECTS_DIR, slug));
}

export function projectJsonPath(slug: string): string {
  return path.resolve(projectDir(slug), "project.json");
}

export function projectPlanPath(slug: string): string {
  return path.resolve(projectDir(slug), "plan.md");
}

export function projectSlicesDir(slug: string): string {
  return path.resolve(projectDir(slug), "slices");
}

// ─── workspace.json CRUD ──────────────────────────────────────────────────────

export async function loadWorkspace(): Promise<Workspace> {
  await migrateLegacyWorkspaceIfNeeded();
  try {
    return await readJsonFile(WORKSPACE_JSON_PATH, WorkspaceSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 2, revision: 0, projects: [] };
    }
    throw error;
  }
}

export async function saveWorkspace(workspace: Workspace, options: { bumpRevision?: boolean } = {}): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const next = WorkspaceSchema.parse({ ...workspace, revision: options.bumpRevision ? workspace.revision + 1 : workspace.revision });
  await writeJsonFile(WORKSPACE_JSON_PATH, next);
}

export async function listProjectSlugs(): Promise<string[]> {
  const workspace = await loadWorkspace();
  return workspace.projects.map((p) => p.slug);
}

export function findProjectEntry(workspace: Workspace, slugOrId: string): WorkspaceProjectEntry | undefined {
  return workspace.projects.find((p) => p.slug === slugOrId);
}

// ─── 多项目初始化 ─────────────────────────────────────────────────────────────

export type InitWorkspaceIfExists = "error" | "return_existing" | "overwrite";
export type InitProjectKind = "worldbook" | "character_card" | "mixed";

export interface WorkspacePaths {
  workspace_dir: string;
  workspace_json: string;
  project_dir: string;
  project_json: string;
  plan_md: string;
  slices_dir: string;
  logs_dir: string;
  latest_log: string;
}

export async function initWorkspaceProject(input: {
  name: string;
  projectId?: string;
  slug?: string;
  kind?: InitProjectKind;
  ifExists?: InitWorkspaceIfExists;
}): Promise<{ project: Project; created: boolean; workspace: WorkspacePaths; slug: string }> {
  const ifExists = input.ifExists ?? "error";
  const kind = input.kind ?? "worldbook";
  const slug = input.slug ?? resolveProjectSlug(input.name);

  const workspace = await loadWorkspace();
  const existingEntry = findProjectEntry(workspace, slug);

  if (existingEntry && ifExists === "error") {
    throw new Error(`项目 "${slug}" 已存在；如需复用请设置 if_exists=return_existing，如需重建请设置 if_exists=overwrite`);
  }

  if (existingEntry && ifExists === "return_existing") {
    const project = await readProjectJson(slug);
    await ensureProjectDirs(slug);
    return { project, created: false, workspace: workspacePaths(slug), slug };
  }

  if (existingEntry && ifExists === "overwrite") {
    await clearProjectData(slug);
  }

  await ensureProjectDirs(slug);
  const timestamp = nowIso();
  const project: Project = {
    id: input.projectId ?? createId("project"),
    slug,
    name: input.name,
    output_type: kind,
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    plan: { enabled_assets: {} },
    imports: [],
    extraRegexScripts: [],
    logs: { session_id: currentSessionId(), latest_log_path: LATEST_LOG_PATH },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeProjectJson(slug, project);

  // 更新 workspace.json
  const entry: WorkspaceProjectEntry = { slug, name: input.name, output_type: kind };
  if (existingEntry) {
    workspace.projects = workspace.projects.map((p) => p.slug === slug ? entry : p);
  } else {
    workspace.projects.push(entry);
  }
  if (!workspace.default_project) workspace.default_project = slug;
  await saveWorkspace(workspace, { bumpRevision: true });
  await ensureLogDir();

  return { project, created: true, workspace: workspacePaths(slug), slug };
}

// ─── 项目 JSON 读写 ──────────────────────────────────────────────────────────

export async function readProjectJson(slug: string): Promise<Project> {
  const filePath = projectJsonPath(slug);
  const project = await readJsonFile(filePath, ProjectSchema);
  const { draft: _legacyDraft, ...metadata } = project;
  return metadata;
}

export async function writeProjectJson(slug: string, project: Project): Promise<void> {
  await ensureProjectDirs(slug);
  const { draft: _draft, ...metadata } = project;
  await writeJsonFile(projectJsonPath(slug), metadata);
}

// ─── 按 project_id 查找 slug ─────────────────────────────────────────────────

export async function findSlugByProjectId(projectId: string): Promise<string | undefined> {
  const workspace = await loadWorkspace();
  for (const entry of workspace.projects) {
    try {
      const project = await readProjectJson(entry.slug);
      if (project.id === projectId) return entry.slug;
    } catch {
      // 跳过无法读取的项目
    }
  }
  return undefined;
}

export async function requireSlugByProjectId(projectId: string): Promise<string> {
  const slug = await findSlugByProjectId(projectId);
  if (!slug) throw new Error(`未找到 project_id=${projectId} 对应的项目`);
  return slug;
}

// ─── 目录管理 ─────────────────────────────────────────────────────────────────

export async function ensureProjectDirs(slug: string): Promise<void> {
  const dir = projectDir(slug);
  await fs.mkdir(dir, { recursive: true });
  await ensureDraftDirs(slug);
  await ensurePlanFileForProject(slug);
}

async function ensurePlanFileForProject(slug: string): Promise<void> {
  const planPath = projectPlanPath(slug);
  try {
    await fs.writeFile(planPath, DEFAULT_PLAN, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

async function clearProjectData(slug: string): Promise<void> {
  const dir = projectDir(slug);
  await fs.rm(dir, { recursive: true, force: true });
}

export function workspacePaths(slug: string): WorkspacePaths {
  return {
    workspace_dir: WORKSPACE_DIR,
    workspace_json: WORKSPACE_JSON_PATH,
    project_dir: projectDir(slug),
    project_json: projectJsonPath(slug),
    plan_md: projectPlanPath(slug),
    slices_dir: projectSlicesDir(slug),
    logs_dir: path.dirname(LATEST_LOG_PATH),
    latest_log: LATEST_LOG_PATH,
  };
}

// ─── 旧版兼容：ensureWorkspaceDirs（供 tool-log 等使用） ──────────────────────

export async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  await migrateLegacyWorkspaceIfNeeded();
  await ensureLogDir();
}

// ─── 根目录模板 JSON ─────────────────────────────────────────────────────────

export interface RootTemplateResult {
  created: boolean;
  reason: "created" | "existing_tavern_json";
  path?: string;
  existing_files?: string[];
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
      const parsed = await readJsonFile(filePath);
      if (isTavernJson(parsed)) result.push(filePath);
    } catch {
      // 忽略无效 JSON 或无法读取的文件
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

const DEFAULT_PLAN = `# World Book MCP Plan

## 1. 用户原始需求

## 2. 任务类型与输出目标

## 3. 已导入资产

## 4. 用户决策记录

| 问题 | 用户回答 | 说明 |
|---|---|---|

## 5. 世界观设定

## 6. 角色设定

## 7. 事件 / 场景 / 地点

## 8. 物品 / 能力 / 装备

## 9. MVU 设计

## 10. HTML 美化设计

## 11. EJS 动态内容设计

## 12. 文风要求

## 13. Draft 切片计划

## 14. 校验计划

## 15. 导出计划
`;

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
