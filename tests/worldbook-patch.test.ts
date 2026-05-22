import { describe, expect, it } from "vitest";
import { applyPatchToDraft } from "../src/core/worldbook-patch.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

function entry(comment = "条目A"): WorldbookDraftEntry {
  return {
    comment,
    entryType: "other",
    keys: [comment],
    secondaryKeys: [],
    content: "<entry>\ncontent: test\n</entry>",
    constant: false,
    position: "after_char",
    order: 10,
    enabled: true,
    scanDepth: 2,
    preventRecursion: true,
    excludeRecursion: true,
  };
}

describe("applyPatchToDraft", () => {
  it("adds entries", () => {
    const result = applyPatchToDraft([entry()], [{ op: "add_entry", entry: entry("条目B") }]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1].comment).toBe("条目B");
  });

  it("updates entries", () => {
    const result = applyPatchToDraft([entry()], [{ op: "update_entry", match: { comment: "条目A" }, changes: { content: "<entry>\ncontent: updated\n</entry>" } }]);
    expect(result.entries[0].content).toContain("updated");
    expect(result.entries[0].preventRecursion).toBe(true);
  });

  it("deletes entries", () => {
    const result = applyPatchToDraft([entry(), entry("条目B")], [{ op: "delete_entry", match: { index: 0 } }]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].comment).toBe("条目B");
  });

  it("reorders entries", () => {
    const result = applyPatchToDraft([entry()], [{ op: "reorder_entry", match: { index: 0 }, order: 99 }]);
    expect(result.entries[0].order).toBe(99);
  });

  it("toggles entries", () => {
    const result = applyPatchToDraft([entry()], [{ op: "toggle_entry", match: { index: 0 }, enabled: false }]);
    expect(result.entries[0].enabled).toBe(false);
  });

  it("matches uid against imported sourceUid before draft index", () => {
    const importedA = { ...entry("导入A"), sourceUid: 10 };
    const importedB = { ...entry("导入B"), sourceUid: 42 };
    const result = applyPatchToDraft([importedA, importedB], [{ op: "update_entry", match: { uid: 42 }, changes: { content: "<entry>uid matched</entry>" } }]);

    expect(result.entries[0].content).toContain("test");
    expect(result.entries[1].content).toContain("uid matched");
  });

  it("falls back to legacy uid-as-index only when no sourceUid exists", () => {
    const result = applyPatchToDraft([entry("旧A"), entry("旧B")], [{ op: "toggle_entry", match: { uid: 1 }, enabled: false }]);
    expect(result.entries[1].enabled).toBe(false);
  });
});
