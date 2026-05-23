import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDraftSlice, listDraftSlices, upsertDraftSlice } from "../src/storage/draft-store.js";
import { initWorkspaceProject, loadWorkspaceProjectIfMatches, WORKSPACE_DRAFT_DIR, WORKSPACE_PROJECT_PATH } from "../src/storage/workspace-store.js";
import { createProject, ensureStorage, listProjects, loadProject, updateProject } from "../src/storage/project-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(path.dirname(WORKSPACE_PROJECT_PATH), { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
  await fs.rm(path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "output"), { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

function uniqueName(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

describe("workspace store", () => {
  it("ensureStorage only creates .worldbook workspace directories", async () => {
    await cleanupWorkspace();
    await ensureStorage();
    await expect(fs.access(path.dirname(WORKSPACE_PROJECT_PATH))).resolves.toBeUndefined();
    await expect(fs.access(path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "output"))).rejects.toMatchObject({ code: "ENOENT" });
    await cleanupWorkspace();
  });

  it("loadProject only accepts the current workspace project id", async () => {
    await cleanupWorkspace();
    const project = await createProject("当前项目");
    await expect(loadProject(project.id)).resolves.toMatchObject({ id: project.id });
    await expect(loadProject("missing_project")).rejects.toMatchObject({ code: "ENOENT" });
    await cleanupWorkspace();
  });

  it("listProjects returns only the current workspace project", async () => {
    await cleanupWorkspace();
    const project = await createProject("列表项目");
    await updateProject(project.id, (latest) => ({ ...latest, importedWorldbookPath: "列表项目.json" }));
    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project.id);
    expect(projects[0].revision).toBe(1);
    await cleanupWorkspace();
  });

  it("creates .worldbook project, plan, logs and typed draft directories", async () => {
    await cleanupWorkspace();
    const { project, created, workspace } = await initWorkspaceProject({ name: uniqueName("测试项目"), ifExists: "overwrite" });
    expect(created).toBe(true);
    expect(project.name).toContain("测试项目_");
    expect(workspace.project_json).toBe(WORKSPACE_PROJECT_PATH);
    await expect(fs.access(WORKSPACE_PROJECT_PATH)).resolves.toBeUndefined();
    await expect(fs.access(WORKSPACE_DRAFT_DIR)).resolves.toBeUndefined();
    await expect(fs.access(path.join(WORKSPACE_DRAFT_DIR, "worldbook"))).resolves.toBeUndefined();
    await expect(fs.access(workspace.plan_md)).resolves.toBeUndefined();
    await expect(fs.access(workspace.logs_dir)).resolves.toBeUndefined();
    await cleanupWorkspace();
  });

  it("returns existing workspace when requested", async () => {
    await cleanupWorkspace();
    const first = await initWorkspaceProject({ name: "原项目", ifExists: "error" });
    const second = await initWorkspaceProject({ name: "新项目", ifExists: "return_existing" });
    expect(second.created).toBe(false);
    expect(second.project.id).toBe(first.project.id);
    expect(second.project.name).toBe("原项目");
    await cleanupWorkspace();
  });

  it("clears typed draft slices when overwriting workspace", async () => {
    await cleanupWorkspace();
    await initWorkspaceProject({ name: "旧项目", ifExists: "error" });
    await upsertDraftSlice(createDraftSlice({
      type: "worldbook_entry",
      id: "old-entry",
      data: { comment: "旧条目", entryType: "world_summary", keys: ["旧"], secondaryKeys: [], content: "旧内容。", constant: true, position: "before_char", order: 1, enabled: true, preventRecursion: true, excludeRecursion: true },
    }));
    const exportedPath = path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "保留导出.json");
    await fs.writeFile(exportedPath, "keep", "utf8");

    const { project } = await initWorkspaceProject({ name: "新项目", ifExists: "overwrite" });
    const loaded = await loadWorkspaceProjectIfMatches(project.id);

    expect(project.name).toBe("新项目");
    expect(loaded?.draft).toBeUndefined();
    expect(await listDraftSlices("worldbook_entry")).toHaveLength(0);
    await expect(fs.readFile(exportedPath, "utf8")).resolves.toBe("keep");
    await fs.rm(exportedPath, { force: true });
    await cleanupWorkspace();
  });

  it("does not hydrate legacy project.draft from project.json", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "旧草稿不兼容", ifExists: "error" });
    const legacyProject = {
      ...project,
      draft: [{ comment: "旧全量草稿", entryType: "world_summary", keys: ["旧"], secondaryKeys: [], content: "<entry>旧</entry>", constant: true, position: "before_char", order: 1, enabled: true, preventRecursion: true, excludeRecursion: true }],
    };
    await fs.writeFile(WORKSPACE_PROJECT_PATH, `${JSON.stringify(legacyProject, null, 2)}\n`, "utf8");
    await fs.rm(WORKSPACE_DRAFT_DIR, { recursive: true, force: true });

    const loaded = await loadWorkspaceProjectIfMatches(project.id);
    expect(loaded?.draft).toBeUndefined();
    await cleanupWorkspace();
  });
});
