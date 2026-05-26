import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createDraftSlice, upsertDraftSlice } from "../src/storage/draft-store.js";
import { shareSlice, useShared, listShared, SHARED_REGISTRY_PATH } from "../src/storage/shared-store.js";
import { initWorkspaceProject, WORKSPACE_DIR } from "../src/storage/workspace-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

function entrySlice(id: string, content: string) {
  return createDraftSlice({
    type: "entry",
    id,
    data: {
      comment: id,
      entryType: "other",
      keys: [id],
      secondaryKeys: [],
      content,
      constant: true,
      position: "before_char",
      order: 100,
      enabled: true,
      preventRecursion: true,
      excludeRecursion: true,
    },
  });
}

describe("shared store", () => {
  it("shares a slice and uses it in another project independently", async () => {
    await cleanupWorkspace();
    const source = await initWorkspaceProject({ name: "共享源", ifExists: "error" });
    const target = await initWorkspaceProject({ name: "共享目标", ifExists: "error" });
    await upsertDraftSlice(source.slug, entrySlice("entry-a", "源内容"));

    const shared = await shareSlice({ slug: source.slug, type: "entry", id: "entry-a", sharedId: "entry-shared", title: "共享条目" });
    expect(shared.entry.file).toBe("entries/entry-shared.json");
    await expect(fs.access(SHARED_REGISTRY_PATH)).resolves.toBeUndefined();

    const used = await useShared({ slug: target.slug, sharedId: "entry-shared", targetId: "entry-copied" });
    expect(used.slice.id).toBe("entry-copied");
    expect((used.slice.data as { content: string }).content).toBe("源内容");

    const entries = await listShared({ includeContent: true });
    expect(entries).toHaveLength(1);
    expect(entries[0].slice?.id).toBe("entry-shared");
    await cleanupWorkspace();
  });

  it("uses singleton ids for mvu/html assets", async () => {
    await cleanupWorkspace();
    const source = await initWorkspaceProject({ name: "资产源", ifExists: "error" });
    const target = await initWorkspaceProject({ name: "资产目标", ifExists: "error" });
    await upsertDraftSlice(source.slug, createDraftSlice({ type: "mvu", id: "mvu", data: { enabled: true, style: "zod", schema_script: "", initvar: "", update_rules: "", variable_list_path: "stat_data", hide_regex: true, beautify_regex: true } }));

    await shareSlice({ slug: source.slug, type: "mvu", id: "anything", sharedId: "shared-mvu" });
    const used = await useShared({ slug: target.slug, sharedId: "shared-mvu", targetId: "custom-mvu" });
    expect(used.slice.id).toBe("mvu");
    await cleanupWorkspace();
  });
});
