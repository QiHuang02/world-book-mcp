import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initWorkspaceProject, loadWorkspaceProjectIfMatches, WORKSPACE_DRAFT_DIR, WORKSPACE_PROJECT_PATH, writeWorkspaceDraftEntry } from "../src/storage/workspace-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(path.dirname(WORKSPACE_PROJECT_PATH), { recursive: true, force: true });
}

describe("workspace store", () => {
  it("creates .worldbook project and draft directory", async () => {
    await cleanupWorkspace();
    const { project, created, workspace } = await initWorkspaceProject({ name: "测试项目", ifExists: "error" });

    expect(created).toBe(true);
    expect(project.name).toBe("测试项目");
    expect(workspace.project_json).toBe(WORKSPACE_PROJECT_PATH);
    await expect(fs.access(WORKSPACE_PROJECT_PATH)).resolves.toBeUndefined();
    await expect(fs.access(WORKSPACE_DRAFT_DIR)).resolves.toBeUndefined();
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

  it("loads split draft entries before project draft fallback", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "分片项目", ifExists: "error" });
    await writeWorkspaceDraftEntry({
      comment: "新墟城",
      entryType: "world_summary",
      keys: ["新墟"],
      secondaryKeys: [],
      content: "废墟都市。",
      constant: true,
      position: "before_char",
      order: 1,
      enabled: true,
      preventRecursion: true,
      excludeRecursion: true,
    });

    const loaded = await loadWorkspaceProjectIfMatches(project.id);
    expect(loaded?.draft).toHaveLength(1);
    expect(loaded?.draft?.[0].comment).toBe("新墟城");
    await cleanupWorkspace();
  });

  it("clears old split draft entries when overwriting workspace", async () => {
    await cleanupWorkspace();
    await initWorkspaceProject({ name: "旧项目", ifExists: "error" });
    await writeWorkspaceDraftEntry({
      comment: "旧条目",
      entryType: "world_summary",
      keys: ["旧"],
      secondaryKeys: [],
      content: "旧内容。",
      constant: true,
      position: "before_char",
      order: 1,
      enabled: true,
      preventRecursion: true,
      excludeRecursion: true,
    });

    const { project } = await initWorkspaceProject({ name: "新项目", ifExists: "overwrite" });
    const loaded = await loadWorkspaceProjectIfMatches(project.id);

    expect(project.name).toBe("新项目");
    expect(loaded?.draft).toBeUndefined();
    await cleanupWorkspace();
  });
});
