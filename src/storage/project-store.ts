import { ProjectSchema, type Project } from "../schemas/project.js";
import { createId, nowIso } from "../utils/ids.js";
import {
  ensureProjectDirs,
  initWorkspaceProject,
  loadWorkspace,
  readProjectJson,
  requireSlugByProjectId,
  writeProjectJson,
} from "./workspace-store.js";

export async function ensureStorage(): Promise<void> {
  // 在新架构中，存储初始化由 initWorkspaceProject 按需完成
  // 这里只确保 workspace 目录存在
  const { ensureWorkspaceDirs } = await import("./workspace-store.js");
  await ensureWorkspaceDirs();
}

export async function createProject(name: string, projectId?: string): Promise<Project> {
  const { project } = await initWorkspaceProject({ name, projectId: projectId ?? createId("project"), ifExists: "return_existing" });
  return project;
}

export async function loadProject(projectId: string): Promise<Project> {
  const slug = await requireSlugByProjectId(projectId);
  return readProjectJson(slug);
}

export async function loadProjectWithSlug(projectId: string): Promise<{ project: Project; slug: string }> {
  const slug = await requireSlugByProjectId(projectId);
  const project = await readProjectJson(slug);
  return { project, slug };
}

const projectQueues = new Map<string, Promise<unknown>>();

export async function updateProject(projectId: string, mutator: (project: Project) => Project | Promise<Project>, options: { expectedRevision?: number } = {}): Promise<Project> {
  return enqueueProjectWrite(projectId, async () => {
    const { project, slug } = await loadProjectWithSlug(projectId);
    if (options.expectedRevision !== undefined && project.revision !== options.expectedRevision) {
      throw new Error(`project revision conflict: expected ${options.expectedRevision}, current ${project.revision}`);
    }
    const next = await mutator(project);
    const updated = ProjectSchema.parse({ ...next, id: project.id, revision: project.revision + 1, updatedAt: nowIso() });
    await writeProjectJson(slug, updated);
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

/**
 * 包装 updateProject 的常见模式：mutator 同时返回 { project, ...extra }，外部既要把 project 写回工作区，
 * 又要把 extra 字段返回给 caller。
 */
export async function withProjectMutation<T extends { project: Project }>(
  projectId: string,
  mutator: (project: Project) => T | Promise<T>,
): Promise<T> {
  let captured: T | undefined;
  await updateProject(projectId, async (project) => {
    captured = await mutator(project);
    return captured.project;
  });
  if (!captured) throw new Error(`mutator never produced a result for project ${projectId}`);
  return captured;
}

export async function listProjects(): Promise<Project[]> {
  const workspace = await loadWorkspace();
  const projects: Project[] = [];
  for (const entry of workspace.projects) {
    try {
      const project = await readProjectJson(entry.slug);
      projects.push(project);
    } catch {
      // 跳过无法读取的项目
    }
  }
  return projects;
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
    has_profile: Boolean(project.profile),
    has_greetings: Boolean(project.greetings),
    has_character_card_config: Boolean(project.characterCardConfig),
    character_card_name: project.characterCardConfig?.card.name,
    profile: includeContent ? project.profile : undefined,
    greetings: includeContent ? project.greetings : undefined,
    has_mvu_config: Boolean(project.mvuConfig),
    mvu_enabled: project.mvuConfig?.enabled,
    has_html_beautify_config: Boolean(project.htmlBeautifyConfig),
    html_beautify_enabled: project.htmlBeautifyConfig?.enabled,
    html_beautify_target: project.htmlBeautifyConfig?.target,
    has_ejs_config: Boolean(project.ejsConfig),
    ejs_enabled: project.ejsConfig?.enabled,
    extra_regex_script_count: project.extraRegexScripts?.length ?? 0,
    ejs_template_type: project.ejsConfig?.template_type,
    characterCardConfig: includeContent ? project.characterCardConfig : undefined,
    mvuConfig: includeContent ? project.mvuConfig : undefined,
    htmlBeautifyConfig: includeContent ? project.htmlBeautifyConfig : undefined,
    ejsConfig: includeContent ? project.ejsConfig : undefined,
    extraRegexScripts: includeContent ? project.extraRegexScripts : undefined,
    draft: includeContent ? project.draft : undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
