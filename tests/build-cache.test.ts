import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProjectRun, loadFreshBuild } from "../src/core/build-pipeline.js";
import { createEntryTemplate, createMvuTemplate } from "../src/core/templates-v3.js";
import { createDraftSlice, updateDraftSliceWithRevisionCheck, upsertDraftSlice } from "../src/storage/draft-store.js";
import { initWorkspaceProject, WORKSPACE_DIR } from "../src/storage/workspace-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

describe("build cache", () => {
  it("records slice snapshots and reuses unchanged target artifacts", async () => {
    await cleanupWorkspace();
    const { project, slug } = await initWorkspaceProject({ name: "缓存测试", output: "worldbook", source: "original", assets: { mvu: true }, ifExists: "overwrite" });
    await upsertDraftSlice(slug, createDraftSlice({ type: "mvu", data: { ...createMvuTemplate(), schemaScript: "export const Schema = z.object({ stat_data: z.object({ hp: z.string() }) });\nregisterMvuSchema(Schema);", initvar: "stat_data:\n  hp: ok", updateRules: "stat_data:\n  hp: ok" } }));
    await upsertDraftSlice(slug, createDraftSlice({ type: "entry", id: "entry-a", data: { ...createEntryTemplate({ comment: "条目A", entryType: "world_summary" }), keys: [], content: "<entry>初始</entry>" } }));

    const first = await buildProjectRun({ project, slug, target: "all", include_previews: true, force: true });
    const second = await buildProjectRun({ project, slug, target: "all", include_previews: true });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.manifest.inputs.slices.every((slice) => slice.sha256.length > 0 && slice.path.endsWith(".json"))).toBe(true);
    expect(second.manifest.artifacts.some((artifact) => artifact.cache?.reused_from_build_id === first.manifest.build_id)).toBe(true);

    const fresh = await loadFreshBuild({ slug, build_id: second.manifest.build_id });
    expect(fresh.stale).toBe(false);
    await cleanupWorkspace();
  });

  it("marks a build stale when an input slice changes after build", async () => {
    await cleanupWorkspace();
    const { project, slug } = await initWorkspaceProject({ name: "缓存过期测试", output: "worldbook", source: "original", ifExists: "overwrite" });
    await upsertDraftSlice(slug, createDraftSlice({ type: "entry", id: "entry-a", data: { ...createEntryTemplate({ comment: "条目A", entryType: "world_summary" }), keys: [], content: "<entry>初始</entry>" } }));

    const run = await buildProjectRun({ project, slug, target: "all", include_previews: true, force: true });
    await updateDraftSliceWithRevisionCheck(slug, "entry", "entry-a", undefined, (slice) => ({ ...slice, data: { ...(slice.data as object), content: "<entry>已修改</entry>" } }));

    const fresh = await loadFreshBuild({ slug, build_id: run.manifest.build_id });
    expect(fresh.stale).toBe(true);
    expect(fresh.stale_reasons.some((reason) => reason.includes("entry:entry-a"))).toBe(true);
    await cleanupWorkspace();
  });
});
