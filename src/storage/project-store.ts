import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { createId, nowIso } from "../utils/ids.js";
import { safeJsonParse, toPrettyJson } from "../utils/json.js";
import { PROJECTS_DIR } from "./path-policy.js";
import { isWorkspaceProject, loadWorkspaceProjectIfMatches, writeWorkspaceProject } from "./workspace-store.js";

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

function projectPath(projectId: string): string {
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

export async function createProject(name: string, projectId?: string): Promise<Project> {
  await ensureStorage();
  const timestamp = nowIso();
  const project: Project = {
    id: projectId ?? createId("project"),
    name,
    sources: [],
    research: [],
    patches: [],
    characterCardPatches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeProject(project);
  return project;
}

export async function loadProject(projectId: string): Promise<Project> {
  const workspaceProject = await loadWorkspaceProjectIfMatches(projectId);
  if (workspaceProject) return workspaceProject;
  await ensureStorage();
  const text = await fs.readFile(projectPath(projectId), "utf8");
  return ProjectSchema.parse(safeJsonParse(text));
}

const projectQueues = new Map<string, Promise<unknown>>();

// 保留给完整 Project 替换场景；常规修改请优先使用 updateProject，以获得更明确的 revision 冲突检测语义。
export async function saveProject(project: Project): Promise<Project> {
  return enqueueProjectWrite(project.id, async () => {
    const latest = await loadProjectIfExists(project.id);
    const updated = { ...project, revision: (latest?.revision ?? project.revision ?? 0) + 1, updatedAt: nowIso() };
    if (await isWorkspaceProject(project.id)) await writeWorkspaceProject(updated);
    else await writeProject(updated);
    return updated;
  });
}

export async function updateProject(projectId: string, mutator: (project: Project) => Project | Promise<Project>, options: { expectedRevision?: number } = {}): Promise<Project> {
  return enqueueProjectWrite(projectId, async () => {
    const project = await loadProject(projectId);
    if (options.expectedRevision !== undefined && project.revision !== options.expectedRevision) {
      throw new Error(`project revision conflict: expected ${options.expectedRevision}, current ${project.revision}`);
    }
    const next = await mutator(project);
    const updated = { ...next, id: project.id, revision: project.revision + 1, updatedAt: nowIso() };
    if (await isWorkspaceProject(project.id)) await writeWorkspaceProject(updated);
    else await writeProject(updated);
    return updated;
  });
}

async function writeProject(project: Project): Promise<void> {
  await ensureStorage();
  await fs.writeFile(projectPath(project.id), toPrettyJson(project), "utf8");
}

async function loadProjectIfExists(projectId: string): Promise<Project | undefined> {
  try {
    return await loadProject(projectId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function enqueueProjectWrite<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = projectQueues.get(projectId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  projectQueues.set(projectId, next.finally(() => {
    if (projectQueues.get(projectId) === next) projectQueues.delete(projectId);
  }));
  return next;
}

export async function loadOrCreateProject(projectId: string | undefined, fallbackName: string): Promise<Project> {
  if (projectId) {
    return loadProject(projectId);
  }
  return createProject(fallbackName);
}

export async function listProjects(): Promise<Project[]> {
  await ensureStorage();
  const files = await fs.readdir(PROJECTS_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const text = await fs.readFile(path.join(PROJECTS_DIR, file), "utf8");
    projects.push(ProjectSchema.parse(safeJsonParse(text)));
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function summarizeProject(project: Project, includeContent = false): unknown {
  return {
    id: project.id,
    name: project.name,
    sources: includeContent ? project.sources : project.sources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      tags: source.tags,
      characters: source.content.length,
      createdAt: source.createdAt,
    })),
    research: project.research.map((bundle) => ({
      id: bundle.id,
      topic: bundle.topic,
      item_count: bundle.items.length,
      items: includeContent ? bundle.items : undefined,
      createdAt: bundle.createdAt,
    })),
    has_extraction: Boolean(project.extraction),
    extraction_summary: project.extraction ? {
      title: project.extraction.title,
      character_count: project.extraction.characters.length,
      world_fact_count: project.extraction.world.length,
      item_count: project.extraction.items.length,
      event_count: project.extraction.events.length,
    } : undefined,
    has_worldbuilding_summary: Boolean(project.worldbuildingSummary),
    worldbuilding_summary: includeContent ? project.worldbuildingSummary : undefined,
    plan_count: project.plan?.length ?? 0,
    draft_count: project.draft?.length ?? 0,
    importedWorldbookPath: project.importedWorldbookPath,
    importedCharacterCardPath: project.importedCharacterCardPath,
    revision: project.revision,
    patch_count: project.patches?.length ?? 0,
    patches: includeContent ? project.patches : project.patches?.map((patch) => ({ id: patch.id, operation_count: patch.operations.length, createdAt: patch.createdAt })),
    character_card_patch_count: project.characterCardPatches?.length ?? 0,
    characterCardPatches: includeContent ? project.characterCardPatches : project.characterCardPatches?.map((patch) => ({ id: patch.id, operation_count: patch.operations.length, createdAt: patch.createdAt })),
    has_character_card_config: Boolean(project.characterCardConfig),
    character_card_name: project.characterCardConfig?.card.name,
    has_mvu_config: Boolean(project.mvuConfig),
    mvu_enabled: project.mvuConfig?.enabled,
    has_html_beautify_config: Boolean(project.htmlBeautifyConfig),
    html_beautify_enabled: project.htmlBeautifyConfig?.enabled,
    html_beautify_target: project.htmlBeautifyConfig?.target,
    has_ejs_config: Boolean(project.ejsConfig),
    ejs_enabled: project.ejsConfig?.enabled,
    ejs_template_type: project.ejsConfig?.template_type,
    characterCardConfig: includeContent ? project.characterCardConfig : undefined,
    mvuConfig: includeContent ? project.mvuConfig : undefined,
    htmlBeautifyConfig: includeContent ? project.htmlBeautifyConfig : undefined,
    ejsConfig: includeContent ? project.ejsConfig : undefined,
    draft: includeContent ? project.draft : undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
