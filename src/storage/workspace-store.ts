import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, defaultProjectKind, type OpeningDesign, type Project, type SourceManifest } from "../schemas/project.js";
import { WorkspaceSchema, type ProjectOutputKind, type ProjectSourceKind, type Workspace, type WorkspaceProjectEntry } from "../schemas/workspace.js";
import { createId, nowIso } from "../utils/ids.js";
import { readJsonFile, toPrettyJson } from "../utils/json.js";
import { readYamlFile, writeYamlFile } from "../utils/yaml.js";
import { assertInside, ROOT_DIR, sanitizeFilename, writeTextFileSafely } from "./path-policy.js";
import { ensureDraftDirs } from "./draft-store.js";
import { ensureLogDir, LATEST_LOG_PATH, currentSessionId } from "./tool-log.js";

export const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
export const LEGACY_JSON_WORKSPACE_MESSAGE = "检测到 v3 JSON 工作区；v4 不支持旧存储，请重新 init_project/import_existing_json 或手动导入 Tavern JSON。";
export const WORKSPACE_YAML_PATH = path.resolve(WORKSPACE_DIR, "workspace.yaml");
export const WORKSPACE_JSON_PATH = WORKSPACE_YAML_PATH;
const LEGACY_WORKSPACE_JSON_PATH = path.resolve(WORKSPACE_DIR, "workspace.json");
const PROJECTS_DIR = path.resolve(WORKSPACE_DIR, "projects");

export function resolveProjectSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base || sanitizeFilename(name);
}

export function projectDir(slug: string): string { return assertInside(PROJECTS_DIR, path.resolve(PROJECTS_DIR, slug)); }
export function projectYamlPath(slug: string): string { return path.resolve(projectDir(slug), "project.yaml"); }
export const projectJsonPath = projectYamlPath;
export function projectPlanPath(slug: string): string { return path.resolve(projectDir(slug), "plan.md"); }
export function projectSlicesDir(slug: string): string { return path.resolve(projectDir(slug), "slices"); }
export function projectBuildDir(slug: string): string { return path.resolve(projectDir(slug), "build"); }
export function projectLogsDir(slug: string): string { return path.resolve(projectDir(slug), "logs"); }
export function projectBackupsDir(slug: string): string { return path.resolve(projectDir(slug), "backups"); }

export async function loadWorkspace(): Promise<Workspace> {
  try {
    const raw = await readYamlFile(WORKSPACE_YAML_PATH) as { version?: unknown };
    if (raw.version !== 4) throw new Error(`.worldbook workspace version=${String(raw.version)} 不符合 v4 schema；请重新 init_project/import_existing_json。`);
    return WorkspaceSchema.parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await assertNoLegacyWorkspaceJson();
      const timestamp = nowIso();
      return { version: 4, revision: 0, projects: [], createdAt: timestamp, updatedAt: timestamp };
    }
    throw error;
  }
}

export async function saveWorkspace(workspace: Workspace, options: { bumpRevision?: boolean } = {}): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const next = WorkspaceSchema.parse({ ...workspace, revision: options.bumpRevision ? workspace.revision + 1 : workspace.revision, updatedAt: nowIso() });
  await writeYamlFile(WORKSPACE_YAML_PATH, next);
}

export function findProjectEntry(workspace: Workspace, slugOrId: string): WorkspaceProjectEntry | undefined {
  return workspace.projects.find((p) => p.slug === slugOrId || p.project_id === slugOrId);
}

export type InitWorkspaceIfExists = "error" | "overwrite";

export interface WorkspacePaths {
  workspace_dir: string;
  workspace_yaml: string;
  workspace_json: string;
  project_dir: string;
  project_yaml: string;
  project_json: string;
  plan_md: string;
  slices_dir: string;
  build_dir: string;
  logs_dir: string;
  latest_log: string;
  backups_dir: string;
}


export async function initWorkspaceProject(input: {
  name: string;
  output: ProjectOutputKind;
  source: ProjectSourceKind;
  assets?: Partial<Record<"mvu" | "html" | "regex" | "ejs", boolean>>;
  opening?: OpeningDesign;
  projectId?: string;
  slug?: string;
  ifExists?: InitWorkspaceIfExists;
}): Promise<{ project: Project; created: boolean; workspace: WorkspacePaths; slug: string }> {
  const ifExists = input.ifExists ?? "error";
  const slug = input.slug ?? resolveProjectSlug(input.name);
  await ensureWorkspaceDirs();
  const workspace = await loadWorkspace();
  const existing = findProjectEntry(workspace, slug);
  if (existing && ifExists === "error") throw new Error(`项目 "${slug}" 已存在；如需重建请设置 if_exists=overwrite`);
  if (existing && ifExists === "overwrite") await clearProjectData(slug);

  const timestamp = nowIso();
  const project = ProjectSchema.parse({
    schemaVersion: 4,
    id: input.projectId ?? createId("project"),
    slug,
    name: input.name,
    kind: defaultProjectKind({ output: input.output, source: input.source, assets: input.assets }),
    opening: input.opening,
    sourceManifest: sourceManifestForProject(input.name, input.output),
    plan: {},
    imports: [],
    pendingDecisions: [],
    recordedDecisions: [],
    logs: { session_id: currentSessionId(), latest_log_path: LATEST_LOG_PATH },
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await ensureProjectDirs(slug);
  await writeProjectJson(slug, project);

  const entry: WorkspaceProjectEntry = { slug, project_id: project.id, name: input.name, output: input.output, source: input.source, createdAt: timestamp, updatedAt: timestamp };
  workspace.projects = existing ? workspace.projects.map((item) => item.slug === slug ? entry : item) : [...workspace.projects, entry];
  if (!workspace.default_project) workspace.default_project = slug;
  await saveWorkspace(workspace, { bumpRevision: true });
  await ensureLogDir();
  return { project, created: !existing, workspace: workspacePaths(slug), slug };
}

export async function readProjectYaml(slug: string): Promise<Project> {
  try {
    return await readYamlFile(projectYamlPath(slug), ProjectSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") await assertNoLegacyProjectJson(slug);
    throw error;
  }
}
export async function writeProjectYaml(slug: string, project: Project): Promise<void> { await ensureProjectDirs(slug); await writeYamlFile(projectYamlPath(slug), ProjectSchema.parse(project)); }
export const readProjectJson = readProjectYaml;
export const writeProjectJson = writeProjectYaml;

export async function findSlugByProjectId(projectId: string): Promise<string | undefined> {
  const workspace = await loadWorkspace();
  const direct = findProjectEntry(workspace, projectId);
  if (direct) return direct.slug;
  for (const entry of workspace.projects) {
    try { const project = await readProjectJson(entry.slug); if (project.id === projectId) return entry.slug; } catch { /* skip */ }
  }
  return undefined;
}

export async function requireSlugByProjectId(projectId: string): Promise<string> {
  const slug = await findSlugByProjectId(projectId);
  if (!slug) throw new Error(`未找到 project_id=${projectId} 对应的项目`);
  return slug;
}

export async function ensureProjectDirs(slug: string): Promise<void> {
  await fs.mkdir(projectDir(slug), { recursive: true });
  await ensureDraftDirs(slug);
  await ensurePlanFileForProject(slug);
  await fs.mkdir(projectBuildDir(slug), { recursive: true });
  await fs.mkdir(projectLogsDir(slug), { recursive: true });
  await fs.mkdir(projectBackupsDir(slug), { recursive: true });
}

async function ensurePlanFileForProject(slug: string): Promise<void> {
  const planPath = projectPlanPath(slug);
  try { await fs.writeFile(planPath, DEFAULT_PLAN, { encoding: "utf8", flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
}

async function clearProjectData(slug: string): Promise<void> { await fs.rm(projectDir(slug), { recursive: true, force: true }); }

export function workspacePaths(slug: string): WorkspacePaths {
  return {
    workspace_dir: WORKSPACE_DIR,
    workspace_yaml: WORKSPACE_YAML_PATH,
    workspace_json: WORKSPACE_YAML_PATH,
    project_dir: projectDir(slug),
    project_yaml: projectYamlPath(slug),
    project_json: projectYamlPath(slug),
    plan_md: projectPlanPath(slug),
    slices_dir: projectSlicesDir(slug),
    build_dir: projectBuildDir(slug),
    logs_dir: projectLogsDir(slug),
    latest_log: LATEST_LOG_PATH,
    backups_dir: projectBackupsDir(slug),
  };
}

export async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const workspace = await loadWorkspace();
  await saveWorkspace(workspace);
  await ensureLogDir();
}

export interface RootTemplateResult { created: boolean; reason: "created" | "existing_tavern_json"; path?: string; existing_files?: string[] }

export async function ensureRootTemplateJson(input: { name: string; output?: ProjectOutputKind }): Promise<RootTemplateResult> {
  const existingFiles = (await findRootTavernJsonFiles()).filter((file) => !path.basename(file).startsWith(sanitizeFilename(input.name)));
  if (existingFiles.length > 0) return { created: false, reason: "existing_tavern_json", existing_files: existingFiles };
  const template = input.output === "character_card" || input.output === "both" ? characterCardTemplate(input.name) : worldbookTemplate(input.name);
  const filename = `${sanitizeFilename(input.name)}.json`;
  const outputPath = assertInside(ROOT_DIR, path.resolve(ROOT_DIR, filename));
  await writeTextFileSafely(outputPath, toPrettyJson(template), { overwrite: false });
  return { created: true, reason: "created", path: outputPath };
}

export async function findRootTavernJsonFiles(): Promise<string[]> {
  const files = await fs.readdir(ROOT_DIR, { withFileTypes: true }).catch(() => []);
  const result: string[] = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;
    const filePath = path.resolve(ROOT_DIR, file.name);
    try { if (isTavernJson(await readJsonFile(filePath))) result.push(filePath); } catch { /* ignore */ }
  }
  return result.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

async function assertNoLegacyWorkspaceJson(): Promise<void> {
  try {
    await fs.access(LEGACY_WORKSPACE_JSON_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(LEGACY_JSON_WORKSPACE_MESSAGE);
}

async function assertNoLegacyProjectJson(slug: string): Promise<void> {
  const legacyPath = path.resolve(projectDir(slug), "project.json");
  try {
    await fs.access(legacyPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`检测到 v3 JSON project 文件 ${legacyPath}；v4 不支持旧存储，请重新 init_project/import_existing_json。`);
}

function sourceManifestForProject(name: string, output: ProjectOutputKind): SourceManifest {
  return ProjectSchema.shape.sourceManifest.parse({
    exportTargets: {
      ...(output === "worldbook" || output === "both" ? { worldbook: `${sanitizeFilename(name)}.worldbook.json` } : {}),
      ...(output === "character_card" || output === "both" ? { characterCard: `${sanitizeFilename(name)}.card.json` } : {}),
    },
  });
}

const DEFAULT_PLAN = `# World Book MCP Plan

## 1. 用户原始需求

## 2. Project.kind

## 3. output / source / assets

## 4. opening 设计

## 5. 用户决策记录

| 问题 | 用户回答 | 说明 |
|---|---|---|

## 6. Draft Slice 计划

## 7. MVU / HTML / regex / EJS 资产计划

## 8. Build / Delivery 计划

## 9. 内容规则自查记录

## 10. 导出计划
`;

function isTavernJson(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.spec === "chara_card_v3") return true;
  const data = record.data;
  if (data && typeof data === "object" && Array.isArray(((data as Record<string, unknown>).character_book as Record<string, unknown> | undefined)?.entries)) return true;
  return Boolean(record.entries && typeof record.entries === "object" && !Array.isArray(record.entries));
}
function worldbookTemplate(name: string): unknown { return { name, entries: {} }; }
function characterCardTemplate(name: string): unknown { return { spec: "chara_card_v3", spec_version: "3.0", name, data: { name, description: "", personality: "", scenario: "", first_mes: "", mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "", tags: [], creator: "", character_version: "1.0", alternate_greetings: [], group_only_greetings: [], extensions: { talkativeness: "0.5", fav: false, world: name, depth_prompt: { prompt: "", depth: 4, role: "system" } }, character_book: { name: `${name}世界书`, entries: [] } } }; }
