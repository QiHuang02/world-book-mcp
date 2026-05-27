import type { Project } from "../schemas/project.js";
import type { Workspace } from "../schemas/workspace.js";

export interface VersionExpectations {
  expected_workspace_revision?: number;
  expected_project_revision?: number;
  expected_slice_revision?: number;
}

export interface VersionSnapshot {
  workspace_revision?: number;
  project_revision?: number;
  slice_revision?: number;
}

export function resolveExpectedProjectRevision(input: VersionExpectations): number | undefined { return input.expected_project_revision; }

export function assertProjectRevisionValue(project: Project, expected?: number): void {
  if (expected !== undefined && project.revision !== expected) throw new Error(`project revision conflict: expected ${expected}, current ${project.revision}`);
}

export function versionSnapshot(input: { workspace?: Workspace; project?: Project; slice_revision?: number }): VersionSnapshot {
  return { workspace_revision: input.workspace?.revision, project_revision: input.project?.revision, slice_revision: input.slice_revision };
}
