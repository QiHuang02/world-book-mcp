import { describe, expect, it } from "vitest";
import { updateDraftSliceField, updateDraftSliceFields } from "../src/core/draft-field-editor.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import { createDraftSlice } from "../src/storage/draft-store.js";

describe("draft field editor simplified slices", () => {
  it("allows direct mvu schema_script edits", () => {
    const slice = createDraftSlice({ type: "mvu", id: "mvu", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    const updated = updateDraftSliceField(slice, "schema_script", "export const Schema = z.object({})");
    expect((updated.data as { schema_script: string }).schema_script).toContain("Schema");
  });

  it("allows direct mvu initvar and update_rules edits", () => {
    const slice = createDraftSlice({ type: "mvu", id: "mvu", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    expect((updateDraftSliceField(slice, "initvar", "foo: 1").data as { initvar: string }).initvar).toBe("foo: 1");
    expect((updateDraftSliceField(slice, "update_rules", "foo: check").data as { update_rules: string }).update_rules).toBe("foo: check");
  });

  it("still allows mvu switches", () => {
    const slice = createDraftSlice({ type: "mvu", id: "mvu", data: createMvuTemplate({ characterNames: ["角色A"] }).mvu });
    const updated = updateDraftSliceField(slice, "hide_regex", false);
    expect((updated.data as { hide_regex: boolean }).hide_regex).toBe(false);
  });

  it("strips YAML doc separators from entry content on field update", () => {
    const slice = createDraftSlice({
      type: "entry",
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

  it("disables EJS stage entries when role is changed with a single field update", () => {
    const slice = createDraftSlice({ type: "ejs", id: "ejs-1", data: { name: "inline", role: "inline", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true } });
    const updated = updateDraftSliceField(slice, "role", "stage");
    expect((updated.data as { role: string; enabled: boolean }).role).toBe("stage");
    expect((updated.data as { role: string; enabled: boolean }).enabled).toBe(false);
  });

  it("keeps explicitly enabled EJS stage entries in bulk updates", () => {
    const slice = createDraftSlice({ type: "ejs", id: "ejs-1", data: { name: "inline", role: "inline", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true } });
    const updated = updateDraftSliceFields(slice, { role: "stage", enabled: true });
    expect((updated.data as { role: string; enabled: boolean }).role).toBe("stage");
    expect((updated.data as { role: string; enabled: boolean }).enabled).toBe(true);
  });

  it("supports appending nested array values with dot append syntax", () => {
    const slice = createDraftSlice({ type: "ejs", id: "ejs-1", data: { name: "controller", role: "controller", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true, stages: [{ name: "morning", condition: "早晨" }] } });
    const updated = updateDraftSliceField(slice, "stages.append", { name: "night", condition: "夜晚" });
    expect((updated.data as { stages: Array<{ name: string }> }).stages.map((stage) => stage.name)).toEqual(["morning", "night"]);
  });
});
