import { describe, expect, it } from "vitest";
import { updateEjsConfig, updateEntryConfig, updateEntryContent, updateMvuSource } from "../src/core/semantic-editors.js";
import { createEjsTemplate, createEntryTemplate, createMvuTemplate } from "../src/core/templates-v3.js";
import { createDraftSlice } from "../src/storage/draft-store.js";

describe("v3 semantic editors", () => {
  it("updates MVU source fields through a coordinated edit", () => {
    const slice = createDraftSlice({ type: "mvu", data: createMvuTemplate() });
    const updated = updateMvuSource(slice, { schemaScript: "export const Schema = z.object({}); registerMvuSchema(Schema)", initvar: "foo: 1", updateRules: "foo: check" });
    expect((updated.data as { schemaScript: string }).schemaScript).toContain("Schema");
    expect((updated.data as { initvar: string }).initvar).toBe("foo: 1");
    expect((updated.data as { updateRules: string }).updateRules).toBe("foo: check");
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
