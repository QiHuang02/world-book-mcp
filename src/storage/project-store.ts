import { ProjectSchema, type Project } from "../schemas/project.js";
import { createId, nowIso } from "../utils/ids.js";
import { ensureWorkspaceDirs, initWorkspaceProject, isWorkspaceProject, loadWorkspaceProjectIfExists, loadWorkspaceProjectIfMatches, writeWorkspaceProject } from "./workspace-store.js";

export async function ensureStorage(): Promise<void> {
  await ensureWorkspaceDirs();
}

export async function createProject(name: string, projectId?: string): Promise<Project> {
  const { project } = await initWorkspaceProject({ name, projectId: projectId ?? createId("project"), ifExists: "return_existing" });
  return project;
}

export async function loadProject(projectId: string): Promise<Project> {
  const workspaceProject = await loadWorkspaceProjectIfMatches(projectId);
  if (workspaceProject) return workspaceProject;
  const error = new Error(`未找到 .worldbook/project.json 或 project_id 不匹配: ${projectId}`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  throw error;
}

const projectQueues = new Map<string, Promise<unknown>>();

export async function updateProject(projectId: string, mutator: (project: Project) => Project | Promise<Project>, options: { expectedRevision?: number } = {}): Promise<Project> {
  return enqueueProjectWrite(projectId, async () => {
    const project = await loadProject(projectId);
    if (options.expectedRevision !== undefined && project.revision !== options.expectedRevision) {
      throw new Error(`project revision conflict: expected ${options.expectedRevision}, current ${project.revision}`);
    }
    const next = await mutator(project);
    const updated = ProjectSchema.parse({ ...next, id: project.id, revision: project.revision + 1, updatedAt: nowIso() });
    if (!await isWorkspaceProject(project.id)) {
      throw new Error(`project_id 不匹配，当前工作区不是 ${project.id}`);
    }
    await writeWorkspaceProject(updated);
    return updated;
  });
}

function enqueueProjectWrite<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = projectQueues.get(projectId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  projectQueues.set(projectId, next.finally(() => {
    if (projectQueues.get(projectId) === next) projectQueues.delete(projectId);
  }));
  return next;
}

export async function listProjects(): Promise<Project[]> {
  const project = await loadWorkspaceProjectIfExists();
  if (!project) return [];
  return [await loadProject(project.id)];
}

export function summarizeProject(project: Project, includeContent = false): unknown {
  return {
    id: project.id,
    name: project.name,
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
