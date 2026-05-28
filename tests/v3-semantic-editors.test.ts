import { describe, expect, it } from "vitest";
import { normalizeMvuEntryContent } from "../src/core/mvu-entry-templates.js";
import { updateEjsConfig, updateEntryConfig, updateEntryContent, updateMvuSource } from "../src/core/semantic-editors.js";
import { createEjsTemplate, createEntryTemplate, createMvuTemplate } from "../src/core/templates-v3.js";
import { createDraftSlice } from "../src/storage/draft-store.js";

describe("v3 semantic editors", () => {
  it("updates MVU runtime source fields only", () => {
    const slice = createDraftSlice({ type: "mvu", data: createMvuTemplate() });
    const updated = updateMvuSource(slice, { schemaScript: "export const Schema = z.object({}); registerMvuSchema(Schema)", variableListPath: "stat_data", hideRegex: false });
    expect((updated.data as { schemaScript: string }).schemaScript).toContain("Schema");
    expect((updated.data as { variableListPath: string }).variableListPath).toBe("stat_data");
    expect((updated.data as { hideRegex: boolean }).hideRegex).toBe(false);
    expect(updated.data).not.toHaveProperty("initvar");
    expect(updated.data).not.toHaveProperty("updateRules");
  });

  it("normalizes MVU system entry content with semantic wrappers", () => {
    expect(normalizeMvuEntryContent("initvar", "---\n<initvar>\nfoo: 1\n</initvar>\n---")).toBe("<initvar>\nfoo: 1\n</initvar>");
    expect(normalizeMvuEntryContent("updateRules", "foo: check")).toBe("<variable_update_rules>\nfoo: check\n</variable_update_rules>");

    const slice = createDraftSlice({ type: "entry", id: "mvu-update-rules", data: createEntryTemplate({ comment: "[mvu_update]变量更新规则" }) });
    const updated = updateEntryContent(slice, "变量更新规则:\n  hp:\n    check:\n      - 根据状态更新");
    expect((updated.data as { content: string }).content).toBe("<variable_update_rules>\n变量更新规则:\n  hp:\n    check:\n      - 根据状态更新\n</variable_update_rules>");
  });

  it("normalizes entry content through update_entry_content semantics", () => {
    const slice = createDraftSlice({ type: "entry", id: "entry-1", data: createEntryTemplate({ comment: "条目" }) });
    const updated = updateEntryContent(slice, "---\n<entry>foo</entry>\n---");
    expect((updated.data as { content: string }).content).toBe("<entry>foo</entry>");
  });

  it("updates entry config separately from content", () => {
    const slice = createDraftSlice({ type: "entry", id: "entry-1", data: createEntryTemplate({ comment: "条目" }) });
    const updated = updateEntryConfig(slice, { keys: ["条目", " 条目 "], constant: false, scanDepth: 2 });
    expect((updated.data as { keys: string[] }).keys).toEqual(["条目"]);
    expect((updated.data as { constant: boolean }).constant).toBe(false);
    expect((updated.data as { scanDepth: number }).scanDepth).toBe(2);
  });

  it("keeps EJS stage entries disabled by default", () => {
    const slice = createDraftSlice({ type: "ejs", id: "ejs-1", data: createEjsTemplate({ id: "ejs-1", preset: "inline" }) });
    const updated = updateEjsConfig(slice, { role: "stage" });
    expect((updated.data as { role: string; enabled: boolean }).role).toBe("stage");
    expect((updated.data as { role: string; enabled: boolean }).enabled).toBe(false);
  });
});
