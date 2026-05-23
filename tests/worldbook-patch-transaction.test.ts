import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWorldbookJson } from "../src/core/worldbook-builder.js";
import { applyPatchToDraft, createPatch } from "../src/core/worldbook-patch.js";
import { resolveExportPath, ROOT_DIR, writeTempThenCommit, writeTextFileSafely } from "../src/storage/path-policy.js";
import type { Project } from "../src/schemas/project.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";
import { toPrettyJson } from "../src/utils/json.js";

const entry: WorldbookDraftEntry = {
  comment: "条目A",
  entryType: "other",
  keys: ["条目A"],
  secondaryKeys: [],
  content: "<entry>A</entry>",
  constant: true,
  position: "before_char",
  order: 1,
  enabled: true,
  preventRecursion: true,
  excludeRecursion: true,
};

function project(): Project {
  return {
    id: "project_patch_tx",
    name: "事务世界书",
    patches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    draft: [entry],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("worldbook patch export transaction", () => {
  it("does not mutate project draft when overwrite=false hits existing file", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-worldbook-patch-existing.json");
    await fs.writeFile(target, "existing", "utf8");
    const patch = createPatch({ projectId: "project_patch_tx", operations: [{ op: "update_entry", match: { comment: "条目A" }, changes: { content: "<entry>updated</entry>" } }] });
    const original = project();
    const applied = applyPatchToDraft(original.draft!, patch.operations);
    const book = buildWorldbookJson({ name: original.name, entries: applied.entries });

    await expect(writeTextFileSafely(resolveExportPath(target, original.name), toPrettyJson(book), { overwrite: false })).rejects.toMatchObject({ code: "EEXIST" });
    expect(original.draft![0].content).toBe("<entry>A</entry>");
    await fs.rm(target, { force: true });
  });

  it("restores existing target file when project commit fails", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-worldbook-patch-restore.json");
    await fs.writeFile(target, "original", "utf8");

    await expect(writeTempThenCommit({
      targetPath: target,
      content: "updated",
      tempId: "restore-test",
      overwrite: true,
      backup: true,
      commit: async () => {
        throw new Error("commit failed");
      },
    })).rejects.toThrow("commit failed");

    await expect(fs.readFile(target, "utf8")).resolves.toBe("original");
    await fs.rm(target, { force: true });
  });

  it("removes newly written target file when project commit fails without original", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-worldbook-patch-new-rollback.json");
    await fs.rm(target, { force: true });

    await expect(writeTempThenCommit({
      targetPath: target,
      content: "updated",
      tempId: "new-rollback-test",
      overwrite: true,
      backup: true,
      commit: async () => {
        throw new Error("commit failed");
      },
    })).rejects.toThrow("commit failed");

    await expect(fs.access(target)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
