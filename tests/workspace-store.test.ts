import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDraftSlice, draftTypeDir, listDraftSlices, upsertDraftSlice } from "../src/storage/draft-store.js";
import { initWorkspaceProject, loadWorkspace, projectYamlPath, projectSlicesDir, readProjectYaml, WORKSPACE_DIR, WORKSPACE_YAML_PATH } from "../src/storage/workspace-store.js";
import { ensureStorage, listProjects, loadProject, loadProjectWithSlug, updateProject } from "../src/storage/project-store.js";

const worldbookInit = (name: string, ifExists: "error" | "overwrite" = "error") => initWorkspaceProject({ name, output: "worldbook", source: "original", ifExists });

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
  await fs.rm(path.resolve(path.dirname(WORKSPACE_DIR), "output"), { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

function uniqueName(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

describe("workspace store", () => {
  it("ensureStorage only creates .worldbook workspace directories", async () => {
    await cleanupWorkspace();
    await ensureStorage();
    await expect(fs.access(WORKSPACE_DIR)).resolves.toBeUndefined();
    await expect(fs.access(path.resolve(path.dirname(WORKSPACE_DIR), "output"))).rejects.toMatchObject({ code: "ENOENT" });
    await cleanupWorkspace();
  });

  it("loadProject accepts registered workspace project ids", async () => {
    await cleanupWorkspace();
    const project = (await worldbookInit("当前项目")).project;
    await expect(loadProject(project.id)).resolves.toMatchObject({ id: project.id });
    await expect(loadProject("missing_project")).rejects.toThrow(/未找到 project_id/);
    await cleanupWorkspace();
  });

  it("listProjects returns all workspace projects", async () => {
    await cleanupWorkspace();
    const first = (await worldbookInit("列表项目A")).project;
    const second = (await worldbookInit("列表项目B")).project;
    await updateProject(first.id, (latest) => ({ ...latest, importedWorldbookPath: "列表项目.json" }));
    const projects = await listProjects();
    expect(projects.map((p) => p.id).sort()).toEqual([first.id, second.id].sort());
    expect(projects.find((p) => p.id === first.id)?.revision).toBe(1);
    await cleanupWorkspace();
  });

  it("creates workspace.yaml, project directory, plan, logs and typed draft directories", async () => {
    await cleanupWorkspace();
    const { project, created, workspace, slug } = await worldbookInit(uniqueName("测试项目"), "overwrite");
    expect(created).toBe(true);
    expect(project.name).toContain("测试项目_");
    expect(workspace.workspace_json).toBe(WORKSPACE_YAML_PATH);
    await expect(fs.access(WORKSPACE_YAML_PATH)).resolves.toBeUndefined();
    await expect(fs.access(projectYamlPath(slug))).resolves.toBeUndefined();
    await expect(fs.access(projectSlicesDir(slug))).resolves.toBeUndefined();
    await expect(fs.access(draftTypeDir(slug, "entry"))).resolves.toBeUndefined();
    await expect(fs.access(workspace.plan_md)).resolves.toBeUndefined();
    await expect(fs.access(workspace.logs_dir)).resolves.toBeUndefined();
    const workspaceJson = await loadWorkspace();
    expect(workspaceJson.projects.some((entry) => entry.slug === slug)).toBe(true);
    await cleanupWorkspace();
  });

  it("returns existing project with same slug when requested", async () => {
    await cleanupWorkspace();
    const first = await worldbookInit("原项目");
    await expect(worldbookInit("原项目")).rejects.toThrow(/已存在/);
    expect(first.project.name).toBe("原项目");
    await cleanupWorkspace();
  });

  it("clears typed draft slices when overwriting the same project slug", async () => {
    await cleanupWorkspace();
    const first = await worldbookInit("同名项目");
    await upsertDraftSlice(first.slug, createDraftSlice({
      type: "entry",
      id: "old-entry",
      data: { comment: "旧条目", entryType: "world_summary", keys: ["旧"], secondaryKeys: [], content: "旧内容。", constant: true, position: "before_char", order: 1, enabled: true, preventRecursion: true, excludeRecursion: true },
    }));
    const exportedPath = path.resolve(path.dirname(WORKSPACE_DIR), "保留导出.json");
    await fs.writeFile(exportedPath, "keep", "utf8");

    const { project, slug } = await worldbookInit("同名项目", "overwrite");
    const loaded = await readProjectYaml(slug);

    expect(project.name).toBe("同名项目");
    expect(loaded.draft).toBeUndefined();
    expect(await listDraftSlices(slug, "entry")).toHaveLength(0);
    await expect(fs.readFile(exportedPath, "utf8")).resolves.toBe("keep");
    await fs.rm(exportedPath, { force: true });
    await cleanupWorkspace();
  });

  it("uses slices as the project draft source", async () => {
    await cleanupWorkspace();
    const { project, slug } = await worldbookInit("切片草稿源");
    const projectWithInlineDraft = {
      ...project,
      draft: [{ comment: "内联草稿", entryType: "world_summary", keys: ["切片"], secondaryKeys: [], content: "<entry>切片</entry>", constant: true, position: "before_char", order: 1, enabled: true, preventRecursion: true, excludeRecursion: true }],
    };
    await fs.writeFile(projectYamlPath(slug), `${JSON.stringify(projectWithInlineDraft, null, 2)}\n`, "utf8");
    await fs.rm(projectSlicesDir(slug), { recursive: true, force: true });

    const { project: loaded } = await loadProjectWithSlug(project.id);
    expect(loaded.draft).toBeUndefined();
    await cleanupWorkspace();
  });
});
