import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { initWorkspaceProject, loadWorkspaceProjectIfMatches, WORKSPACE_DRAFT_DIR, WORKSPACE_PROJECT_PATH, writeWorkspaceDraftEntry } from "../src/storage/workspace-store.js";
import { createProject, ensureStorage, listProjects, loadProject, updateProject } from "../src/storage/project-store.js";
import { createWorldbookDraftTemplate, updateWorldbookDraftField, updateWorldbookDraftFields } from "../src/core/worldbook-draft-editor.js";
import { validateWorldbookDraft } from "../src/core/worldbook-validator.js";
import { buildWorldbookJson } from "../src/core/worldbook-builder.js";

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

  it("creates .worldbook project and draft directory", async () => {
    await cleanupWorkspace();
    const { project, created, workspace } = await initWorkspaceProject({ name: uniqueName("测试项目"), ifExists: "overwrite" });

    expect(created).toBe(true);
    expect(project.name).toContain("测试项目_");
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

  it("does not overwrite existing workspace when if_exists=error", async () => {
    await cleanupWorkspace();
    await initWorkspaceProject({ name: "原项目", ifExists: "error" });

    await expect(initWorkspaceProject({ name: "新项目", ifExists: "error" })).rejects.toThrow("已存在");
    const loaded = await loadWorkspaceProjectIfMatches((await initWorkspaceProject({ name: "unused", ifExists: "return_existing" })).project.id);
    expect(loaded?.name).toBe("原项目");
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
    const exportedPath = path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "保留导出.json");
    await fs.writeFile(exportedPath, "keep", "utf8");

    const { project } = await initWorkspaceProject({ name: "新项目", ifExists: "overwrite" });
    const loaded = await loadWorkspaceProjectIfMatches(project.id);

    expect(project.name).toBe("新项目");
    expect(loaded?.draft).toBeUndefined();
    await expect(fs.readFile(exportedPath, "utf8")).resolves.toBe("keep");
    await fs.rm(exportedPath, { force: true });
    await cleanupWorkspace();
  });

  it("upserts entries into split draft files and merges them for validation/export", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "分片写入项目", ifExists: "error" });
    await updateProject(project.id, (latest) => {
      const draft = [
        updateWorldbookDraftFields(createWorldbookDraftTemplate({ comment: "新墟城", entry_type: "world_summary" }), { keys: ["新墟"], content: "<entry>新墟城</entry>" }),
        updateWorldbookDraftField(createWorldbookDraftTemplate({ comment: "角色B_基础设定", entry_type: "character_basic", character_name: "角色B" }), "content", "<character>\nname: 角色B\n</character>"),
      ];
      return { ...latest, draft };
    });

    const file = path.join(WORKSPACE_DRAFT_DIR, "角色B_基础设定.json");
    const savedEntry = JSON.parse(await fs.readFile(file, "utf8"));
    expect(savedEntry.characterName).toBe("角色B");
    expect(savedEntry).not.toHaveProperty("uid");
    expect(savedEntry).not.toHaveProperty("displayIndex");

    const loaded = await loadWorkspaceProjectIfMatches(project.id);
    expect(loaded?.draft).toHaveLength(2);
    expect(validateWorldbookDraft(loaded!.draft!).valid).toBe(true);
    const book = buildWorldbookJson({ name: "导出", entries: loaded!.draft! });
    expect(Object.keys(book.entries)).toHaveLength(2);
    await cleanupWorkspace();
  });

  it("retains split draft files after export-style project updates", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "导出保留草稿", ifExists: "error" });
    await updateProject(project.id, (latest) => {
      const draft = [updateWorldbookDraftFields(createWorldbookDraftTemplate({ comment: "保留条目", entry_type: "world_summary" }), { keys: ["保留"], content: "<entry>初版</entry>" })];
      return { ...latest, draft };
    });

    const loadedBeforeExport = await loadWorkspaceProjectIfMatches(project.id);
    const book = buildWorldbookJson({ name: "导出", entries: loadedBeforeExport!.draft! });
    expect(Object.keys(book.entries)).toHaveLength(1);
    await updateProject(project.id, (latest) => ({ ...latest, importedWorldbookPath: path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "导出.json") }));

    const draftFile = path.join(WORKSPACE_DRAFT_DIR, "保留条目.json");
    const savedEntry = JSON.parse(await fs.readFile(draftFile, "utf8"));
    expect(savedEntry.content).toBe("<entry>初版</entry>");
    const loadedAfterExport = await loadWorkspaceProjectIfMatches(project.id);
    expect(loadedAfterExport?.draft).toHaveLength(1);
    expect(loadedAfterExport?.draft?.[0].comment).toBe("保留条目");
    await cleanupWorkspace();
  });

  it("reflects merged patch results in split draft files without clearing them", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "patch保留草稿", ifExists: "error" });
    await updateProject(project.id, (latest) => {
      const draft = [updateWorldbookDraftFields(createWorldbookDraftTemplate({ comment: "可改条目", entry_type: "other" }), { keys: ["可改"], content: "<entry>旧</entry>" })];
      return { ...latest, draft };
    });
    await updateProject(project.id, (latest) => {
      const draft = latest.draft ? [updateWorldbookDraftField(latest.draft[0], "content", "<entry>新</entry>")] : [];
      return { ...latest, draft, importedWorldbookPath: path.resolve(path.dirname(WORKSPACE_PROJECT_PATH), "..", "patch导出.json") };
    });

    const draftFile = path.join(WORKSPACE_DRAFT_DIR, "可改条目.json");
    const savedEntry = JSON.parse(await fs.readFile(draftFile, "utf8"));
    expect(savedEntry.content).toBe("<entry>新</entry>");
    const loaded = await loadWorkspaceProjectIfMatches(project.id);
    expect(loaded?.draft).toHaveLength(1);
    expect(loaded?.draft?.[0].content).toBe("<entry>新</entry>");
    await cleanupWorkspace();
  });

  it("ignores legacy project.draft when split draft directory is empty", async () => {
    await cleanupWorkspace();
    const { project } = await initWorkspaceProject({ name: "旧草稿不兼容", ifExists: "error" });
    const legacyProject = {
      ...project,
      draft: [{
        comment: "旧全量草稿",
        entryType: "world_summary",
        keys: ["旧"],
        secondaryKeys: [],
        content: "<entry>旧</entry>",
        constant: true,
        position: "before_char",
        order: 1,
        enabled: true,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    };
    await fs.writeFile(WORKSPACE_PROJECT_PATH, `${JSON.stringify(legacyProject, null, 2)}\n`, "utf8");
    await fs.rm(WORKSPACE_DRAFT_DIR, { recursive: true, force: true });

    const loaded = await loadWorkspaceProjectIfMatches(project.id);
    expect(loaded?.draft).toBeUndefined();
    await cleanupWorkspace();
  });
});
