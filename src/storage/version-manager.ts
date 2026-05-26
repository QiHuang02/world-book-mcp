import type { DraftType } from "../schemas/draft-slice.js";
import type { Project } from "../schemas/project.js";
import type { Workspace } from "../schemas/workspace.js";
import { readDraftSlice } from "./draft-store.js";
import { loadProjectWithSlug } from "./project-store.js";
import { loadWorkspace } from "./workspace-store.js";

export interface VersionExpectations {
  expected_workspace_revision?: number;
  expected_project_revision?: number;
  expected_revision?: number;
  expected_slice_revision?: number;
}

export interface VersionSnapshot {
  workspace_revision?: number;
  project_revision?: number;
  slice_revision?: number;
}

export function resolveExpectedProjectRevision(input: VersionExpectations): number | undefined {
  return input.expected_project_revision ?? input.expected_revision;
}

export async function assertWorkspaceRevision(expected?: number): Promise<Workspace> {
  const workspace = await loadWorkspace();
  if (expected !== undefined && workspace.revision !== expected) {
    throw new Error(`workspace revision conflict: expected ${expected}, current ${workspace.revision}`);
  }
  return workspace;
}

export function assertProjectRevisionValue(project: Project, expected?: number): void {
  if (expected !== undefined && project.revision !== expected) {
    throw new Error(`project revision conflict: expected ${expected}, current ${project.revision}`);
  }
}

export async function assertProjectRevision(projectId: string, expected?: number): Promise<{ project: Project; slug: string }> {
  const loaded = await loadProjectWithSlug(projectId);
  assertProjectRevisionValue(loaded.project, expected);
  return loaded;
}

export async function assertSliceRevision(slug: string, type: DraftType, id: string, expected?: number): Promise<void> {
  if (expected === undefined) return;
  const slice = await readDraftSlice(slug, type, id);
  if (slice.revision !== expected) {
    throw new Error(`draft slice revision 冲突：expected=${expected}, actual=${slice.revision}`);
  }
}

export function versionSnapshot(input: { workspace?: Workspace; project?: Project; slice_revision?: number }): VersionSnapshot {
  return {
    workspace_revision: input.workspace?.revision,
    project_revision: input.project?.revision,
    slice_revision: input.slice_revision,
  };
}
