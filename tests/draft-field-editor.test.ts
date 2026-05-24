import { describe, expect, it } from "vitest";
import { updateDraftSliceField } from "../src/core/draft-field-editor.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import { createDraftSlice } from "../src/storage/draft-store.js";

describe("draft field editor MVU restrictions", () => {
  it("rejects direct mvu schema_script edits", () => {
    const slice = createDraftSlice({ type: "mvu_schema", id: "schema", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    expect(() => updateDraftSliceField(slice, "schema_script", "registerMvuSchema({})")).toThrow(/不支持字段/);
  });

  it("rejects direct mvu initvar and update_rules edits", () => {
    const slice = createDraftSlice({ type: "mvu_update_rules", id: "rules", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    expect(() => updateDraftSliceField(slice, "initvar", "foo: 1")).toThrow(/不支持字段/);
    expect(() => updateDraftSliceField(slice, "update_rules", "foo: check")).toThrow(/不支持字段/);
  });

  it("still allows mvu switches", () => {
    const slice = createDraftSlice({ type: "mvu_update_rules", id: "rules", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    const updated = updateDraftSliceField(slice, "hide_regex", false);
    expect((updated.data as { hide_regex: boolean }).hide_regex).toBe(false);
  });

  it("strips YAML doc separators from worldbook_entry content on field update", () => {
    const slice = createDraftSlice({
      type: "worldbook_entry",
      id: "entry-1",
      data: {
        comment: "条目",
        entryType: "other",
        keys: ["条目"],
        secondaryKeys: [],
        content: "",
        constant: true,
        position: "before_char",
        order: 100,
        enabled: true,
        preventRecursion: true,
        excludeRecursion: true,
      },
    });
    const updated = updateDraftSliceField(slice, "content", "---\n<entry>foo</entry>\n---");
    expect((updated.data as { content: string }).content).toBe("<entry>foo</entry>");
  });
});
