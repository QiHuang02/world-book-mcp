import { ProjectSchema, type Project } from "../schemas/project.js";
import { nowIso } from "../utils/ids.js";
import { initWorkspaceProject, loadWorkspace, readProjectJson, requireSlugByProjectId, writeProjectJson } from "./workspace-store.js";

export async function ensureStorage(): Promise<void> {
  const { ensureWorkspaceDirs } = await import("./workspace-store.js");
  await ensureWorkspaceDirs();
}

export async function createProject(input: Parameters<typeof initWorkspaceProject>[0]): Promise<Project> {
  const { project } = await initWorkspaceProject(input);
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
    if (options.expectedRevision !== undefined && project.revision !== options.expectedRevision) throw new Error(`project revision conflict: expected ${options.expectedRevision}, current ${project.revision}`);
    const next = await mutator(project);
    const updated = ProjectSchema.parse({ ...next, id: project.id, slug: project.slug, schemaVersion: 3, revision: project.revision + 1, updatedAt: nowIso() });
    await writeProjectJson(slug, updated);
    return updated;
  });
}

function enqueueProjectWrite<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = projectQueues.get(projectId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  projectQueues.set(projectId, next.finally(() => { if (projectQueues.get(projectId) === next) projectQueues.delete(projectId); }));
  return next;
}

export async function listProjects(): Promise<Project[]> {
  const workspace = await loadWorkspace();
  const projects: Project[] = [];
  for (const entry of workspace.projects) {
    try { projects.push(await readProjectJson(entry.slug)); } catch { /* skip */ }
  }
  return projects;
}

export function summarizeProject(project: Project, includeContent = false): unknown {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    schemaVersion: project.schemaVersion,
    kind: project.kind,
    opening: includeContent ? project.opening : project.opening ? { mode: project.opening.mode, user_role: project.opening.user_role, has_premise: Boolean(project.opening.premise) } : undefined,
    revision: project.revision,
    has_profile: Boolean(project.profile),
    has_greetings: Boolean(project.greetings),
    profile: includeContent ? project.profile : undefined,
    greetings: includeContent ? project.greetings : undefined,
    imports: project.imports.map((item) => ({ importId: item.importId, path: item.path, type: item.type, summary: item.summary })),
    pending_decision_count: project.pendingDecisions.length,
    recorded_decision_count: project.recordedDecisions.length,
    pendingDecisions: includeContent ? project.pendingDecisions : undefined,
    recordedDecisions: includeContent ? project.recordedDecisions : undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
