import { describe, expect, it } from "vitest";
import { defaultProjectKind, ProjectSchema } from "../src/schemas/project.js";
import { createDraftSlice } from "../src/storage/draft-store.js";
import { updateEntryConfig, updateEntryContent, upsertRegexScript, removeRegexScript, updateHtmlStatusbar, updateEjsConfig } from "../src/core/semantic-editors.js";
import { createEntryTemplate, createEjsTemplate, createHtmlTemplate, createMvuTemplate, createRegexTemplate } from "../src/core/templates-v3.js";
import { validateProject } from "../src/core/project-validator.js";
import { buildProjectAssets } from "../src/core/project-assets.js";
import { validateRegexScripts } from "../src/core/regex-validator.js";

function projectBase() {
  return ProjectSchema.parse({
    schemaVersion: 3,
    id: "project_demo",
    slug: "demo",
    name: "Demo",
    kind: defaultProjectKind({ output: "character_card", source: "original", assets: { mvu: true, html: true, regex: true, ejs: true } }),
    opening: { mode: "event_hook", user_role: "unspecified", premise: "角色在事件中遇见 user。", user_constraints: [] },
    plan: {},
    profile: { name: "角色A", description: "", personality: "", scenario: "", include_worldbook: true },
    greetings: { first_mes: "<StatusPlaceHolderImpl/>\n雨夜里，角色A抬头看向门口。", alternate_greetings: [] },
    imports: [],
    pendingDecisions: [],
    recordedDecisions: [],
    logs: { session_id: "test", latest_log_path: "logs/latest.jsonl" },
    revision: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("v3 project kind", () => {
  it("uses output/source/assets project kind", () => {
    const kind = defaultProjectKind({ output: "both", source: "composite", assets: { regex: true } });
    expect(kind.output).toBe("both");
    expect(kind.source).toBe("composite");
    expect(kind.assets.regex.planned).toBe(true);
    expect(kind.assets.regex.enabled).toBe(false);
  });
});

describe("v3 draft slices", () => {
  it("uses active envelope and semantic entry editors", () => {
    let slice = createDraftSlice({ type: "entry", id: "entry-a", data: createEntryTemplate({ comment: "角色A-基础" }) });
    expect(slice.active).toBe(true);
    slice = updateEntryContent(slice, "---\n<entry>\nname: 角色A\n</entry>");
    expect((slice.data as { content: string }).content).toBe("<entry>\nname: 角色A\n</entry>");
    slice = updateEntryConfig(slice, { keys: [" 角色A ", "角色A"], constant: false });
    expect((slice.data as { keys: string[] }).keys).toEqual(["角色A"]);
  });

  it("keeps mvu/html singleton ids and regex as grouped scripts", () => {
    const mvu = createDraftSlice({ type: "mvu", data: createMvuTemplate() });
    const html = createDraftSlice({ type: "html", data: createHtmlTemplate() });
    expect(mvu.id).toBe("mvu");
    expect(html.id).toBe("html");

    let regex = createDraftSlice({ type: "regex", id: "custom-regex", data: createRegexTemplate() });
    regex = upsertRegexScript(regex, {
      id: "hide-status",
      scriptName: "隐藏状态",
      order: 1,
      findRegex: "/<status>[\\s\\S]*?<\\/status>/g",
      replaceString: "",
      trimStrings: [],
      placement: [2],
      disabled: false,
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: false,
      substituteRegex: 0,
      minDepth: null,
      maxDepth: null,
      source: "standalone",
    });
    expect((regex.data as { scripts: unknown[] }).scripts).toHaveLength(1);
    regex = removeRegexScript(regex, "hide-status");
    expect(regex.active).toBe(false);
  });
});

describe("v3 assets", () => {
  it("updates HTML statusbar and EJS config through semantic editors", () => {
    let html = createDraftSlice({ type: "html", data: createHtmlTemplate() });
    html = updateHtmlStatusbar(html, { html: "<div class=\"wbm-statusbar\">状态</div>", variablePaths: ["stat_data.角色A.好感度"] });
    expect((html.data as { statusbar: { html: string }; variablePaths: string[] }).statusbar.html).toContain("wbm-statusbar");
    expect((html.data as { variablePaths: string[] }).variablePaths).toEqual(["stat_data.角色A.好感度"]);

    let ejs = createDraftSlice({ type: "ejs", id: "stage-a", data: createEjsTemplate({ id: "stage-a", preset: "stage" }) });
    expect((ejs.data as { enabled: boolean }).enabled).toBe(false);
    ejs = updateEjsConfig(ejs, { role: "stage", enabled: true });
    expect((ejs.data as { role: string; enabled: boolean }).role).toBe("stage");
  });

  it("builds project assets without writing generated regex back to regex slices", () => {
    const project = projectBase();
    const mvu = { ...createMvuTemplate(), schemaScript: "export const Schema = z.object({ hp: z.string().prefault('') });\nregisterMvuSchema(Schema);", initvar: "hp: ok", updateRules: "变量更新规则:\n  hp:\n    check:\n      - 根据状态更新" };
    const assets = buildProjectAssets({ ...project, mvuConfig: mvu }, "all", [], "2026-01-01T00:00:00.000Z");
    expect(assets.regex_scripts.some((script) => script.scriptName.includes("界面占位符"))).toBe(true);
    expect(assets.regex_artifact.summary.source_counts.mvu).toBeGreaterThan(0);
  });
});

describe("v3 validation", () => {
  it("returns delegated content section and delivery/build sections", () => {
    const report = validateProject(projectBase(), { scope: "content" });
    expect(report.sections.content_policy_delegated.status).toBe("skipped");
    expect(report.sections.content_policy_delegated.summary).toMatchObject({ delegated: true });
  });

  it("keeps regex validator issue shape compatible with ValidationIssue", () => {
    const result = validateRegexScripts([{ scriptName: "x", findRegex: "a", replaceString: "b", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: true, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBeTruthy();
  });
});
