import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { WorldbookDraftEntrySchema, type WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createId, nowIso } from "../utils/ids.js";
import { safeJsonParse, toPrettyJson } from "../utils/json.js";
import { assertInside, ROOT_DIR, sanitizeFilename } from "./path-policy.js";

export const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
export const WORKSPACE_PROJECT_PATH = path.resolve(WORKSPACE_DIR, "project.json");
export const WORKSPACE_DRAFT_DIR = path.resolve(WORKSPACE_DIR, "draft");

export type InitWorkspaceIfExists = "error" | "return_existing" | "overwrite";

export async function initWorkspaceProject(input: { name: string; projectId?: string; ifExists?: InitWorkspaceIfExists }): Promise<{ project: Project; created: boolean; workspace: WorkspacePaths }> {
  const ifExists = input.ifExists ?? "error";
  const existing = await loadWorkspaceProjectIfExists();
  if (existing && ifExists === "error") {
    throw new Error(".worldbook/project.json 已存在；如需复用请设置 if_exists=return_existing，如需重建请设置 if_exists=overwrite");
  }
  if (existing && ifExists === "return_existing") {
    await ensureWorkspaceDirs();
    return { project: await withWorkspaceDraft(existing), created: false, workspace: workspacePaths() };
  }

  if (existing && ifExists === "overwrite") {
    await clearWorkspaceDraftEntries();
  }

  await ensureWorkspaceDirs();
  const timestamp = nowIso();
  const project: Project = {
    id: input.projectId ?? createId("project"),
    name: input.name,
    sources: [],
    research: [],
    patches: [],
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
  return withWorkspaceDraft(project);
}

export async function writeWorkspaceProject(project: Project): Promise<void> {
  await ensureWorkspaceDirs();
  const { draft: _draft, ...metadata } = project;
  await fs.writeFile(WORKSPACE_PROJECT_PATH, toPrettyJson(metadata), "utf8");
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
      const text = await fs.readFile(path.join(WORKSPACE_DRAFT_DIR, file), "utf8");
      entries.push(WorldbookDraftEntrySchema.parse(safeJsonParse(text)));
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
  await fs.writeFile(outputPath, toPrettyJson(entry), "utf8");
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

async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_DRAFT_DIR, { recursive: true });
}

async function clearWorkspaceDraftEntries(): Promise<void> {
  await fs.rm(WORKSPACE_DRAFT_DIR, { recursive: true, force: true });
}

async function loadWorkspaceProjectIfExists(): Promise<Project | undefined> {
  try {
    const text = await fs.readFile(WORKSPACE_PROJECT_PATH, "utf8");
    return ProjectSchema.parse(safeJsonParse(text));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function withWorkspaceDraft(project: Project): Promise<Project> {
  const draft = await readWorkspaceDraftEntries();
  return draft ? { ...project, draft } : project;
}
