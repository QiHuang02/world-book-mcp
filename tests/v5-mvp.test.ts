import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCharacterCardJson, buildWorldbookJson, generateJson } from "../src/core/builder.js";
import { configureDraft } from "../src/core/configure-draft.js";
import { repairProject } from "../src/core/repair.js";
import { validateMvuProject } from "../src/core/mvu-validation.js";
import { applyMvuPreset, listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../src/core/mvu-variables.js";
import { createEjsStageTemplate } from "../src/core/creative-tools.js";
import { importNovaConfig } from "../src/core/nova-importer.js";
import { entrySummary, generateTavernSyncConfig, queryEntries, updateEntryStatus } from "../src/core/entry-manifest.js";
import { checkDelivery, readSourceFile, resumeProject } from "../src/core/project-status.js";
import { validateProject, writeValidationMarkdownReport } from "../src/core/validation.js";
import { CardDraftSchema, WorldbookDraftSchema } from "../src/schemas/draft.js";
import { resolveExportFilePath, resolveSourceFilePath } from "../src/storage/path-policy.js";
import { WORKSPACE_PATH, createProject, draftPath, projectDir, projectPath, readDraft, readProjectBySlug, writeDraft, writePlan } from "../src/storage/workspace.js";
import { importExistingJson } from "../src/tools/project-tools.js";
import { WriteSourceFileInputSchema } from "../src/tools/schemas.js";
import { readYamlFile, writeTextFile, writeYamlFile } from "../src/utils/yaml.js";

async function cleanup(name: string): Promise<void> {
  const slug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  await fs.rm(path.resolve(process.cwd(), ".worldbook", "projects", slug), { recursive: true, force: true });
}

async function createTestProject(name: string, output: "worldbook" | "character_card" | "both" = "character_card") {
  await cleanup(name);
  return createProject({ name, output, source: "original", ifExists: "overwrite" });
}

async function writeSource(projectSlug: string, relativePath: string, content: string): Promise<void> {
  await writeTextFile(path.resolve(projectDir(projectSlug), "source", relativePath), content);
}

describe("v5 workspace and draft", () => {
  it("initializes a v5 workspace project with plan, draft and source directories", async () => {
    const { project } = await createTestProject("v5-mvp-workspace");

    await expect(fs.access(projectPath(project, "plan"))).resolves.toBeUndefined();
    await expect(fs.access(draftPath(project, "card"))).resolves.toBeUndefined();
    await expect(fs.access(draftPath(project, "worldbook"))).resolves.toBeUndefined();
    await expect(fs.access(draftPath(project, "assets"))).resolves.toBeUndefined();
    await expect(fs.access(path.resolve(projectDir(project.slug), "source", "entries"))).resolves.toBeUndefined();

    const draft = await readDraft(project);
    expect(draft.card?.description).toBe("");
    expect(draft.card?.first_mes).toBe("../source/fields/first_mes.md");
    const plan = await fs.readFile(projectPath(project, "plan"), "utf8");
    expect(plan).toContain("entries: []");
    expect(plan).toContain("variables: []");
    expect(plan).toContain("## 13. 二创提取索引");
  });

  it("enforces empty card description at schema level", () => {
    expect(() => CardDraftSchema.parse({ name: "x", description: "not empty", first_mes: "../source/fields/first_mes.md" })).toThrow();
  });

  it("keeps planned assets disabled until templates are applied", async () => {
    await cleanup("v5-mvp-planned-assets");
    const { project } = await createProject({ name: "v5-mvp-planned-assets", output: "character_card", source: "original", assets: { mvu: true, html: true, ejs: true }, ifExists: "overwrite" });
    const draft = await readDraft(project);
    expect(project.kind.assets.mvu).toBe("planned");
    expect(draft.assets?.mvu.enabled).toBe(false);
    expect(draft.assets?.html.statusbar.enabled).toBe(false);
    expect(draft.assets?.ejs.enabled).toBe(false);
    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code.startsWith("mvu.") || issue.code === "html.statusbar.html_missing" || issue.code === "assets.ejs_requires_mvu")).toBe(false);
  });

  it("rejects source writes outside the v5 source subdirectories", async () => {
    const { project } = await createTestProject("v5-mvp-source-paths");
    const root = projectDir(project.slug);

    expect(() => resolveSourceFilePath(root, project.paths.sourceRoot, "entries/ok.xyaml")).not.toThrow();
    expect(() => resolveSourceFilePath(root, project.paths.sourceRoot, "../draft/card.yaml")).toThrow("source 文件路径不允许越界");
    expect(() => resolveSourceFilePath(root, project.paths.sourceRoot, "reports/report.md")).toThrow("source 文件必须写入以下目录之一");
    expect(() => resolveSourceFilePath(root, project.paths.sourceRoot, path.resolve(root, "source/entries/abs.xyaml"))).toThrow("source 文件路径必须是相对路径");
    expect(WriteSourceFileInputSchema.parse({ path: "entries/a.xyaml", content: "x" }).overwrite).toBe(false);
  });

  it("rejects export paths outside project exports", async () => {
    const { project } = await createTestProject("v5-mvp-export-paths");
    const root = projectDir(project.slug);

    expect(() => resolveExportFilePath(root, project.paths.exports, "ok.json", "fallback.json")).not.toThrow();
    expect(() => resolveExportFilePath(root, project.paths.exports, "../escape.json", "fallback.json")).toThrow("路径不允许越界");
    expect(() => resolveExportFilePath(root, project.paths.exports, path.resolve(root, "exports/abs.json"), "fallback.json")).toThrow("导出路径必须是相对 exports/ 的路径");
  });
});

describe("v5 validation", () => {
  it("validates a complete character card project", async () => {
    const { project } = await createTestProject("v5-mvp-valid-card");
    await writeSource(project.slug, "fields/first_mes.md", "你好，{{user}}。\n");
    await writeSource(project.slug, "fields/personality.md", "");
    await writeSource(project.slug, "fields/scenario.md", "");
    await writeSource(project.slug, "fields/mes_example.md", "");
    await writeSource(project.slug, "fields/creator_notes.md", "");
    await writeSource(project.slug, "fields/system_prompt.md", "");
    await writeSource(project.slug, "fields/post_history_instructions.md", "");
    await writeSource(project.slug, "entries/001-world.xyaml", "<world>测试世界</world>\n");

    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "world-summary",
        comment: "世界观总纲",
        type: "world_summary",
        content: "../source/entries/001-world.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "before_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });

    const report = await validateProject(project);
    expect(report.ok).toBe(true);
    expect(report.summary.errors).toBe(0);
  });

  it("allows empty optional card fields and warns when character content stays in card fields", async () => {
    const { project } = await createTestProject("v5-mvp-card-field-rules");
    await writeSource(project.slug, "fields/first_mes.md", "你好\n");
    let report = await validateProject(project);
    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === "source_reference.missing" && issue.field === "card.personality")).toBe(false);

    await writeDraft(project, "card", { ...(await readDraft(project)).card!, personality: "内联性格内容" });
    report = await validateProject(project);
    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === "card.field.inline_content" && issue.field === "card.personality")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "card.field.should_be_worldbook" && issue.field === "card.personality")).toBe(true);
  });

  it("rejects green entries without keys", async () => {
    const { project } = await createTestProject("v5-mvp-green-keys", "worldbook");
    await writeSource(project.slug, "entries/green.xyaml", "content\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "green",
        comment: "绿灯条目",
        content: "../source/entries/green.xyaml",
        enabled: true,
        constant: false,
        keys: [],
        secondary_keys: [],
        position: "after_char",
        order: 1,
        depth: 4,
        scanDepth: 2,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });

    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "worldbook.entry.green_missing_keys")).toBe(true);
  });

  it("rejects statusbar html with scripts, external urls, or naked stat_data macros", async () => {
    const { project } = await createTestProject("v5-mvp-html-rules", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n");
    await writeSource(project.slug, "html/statusbar.html", "<script></script><img src=\"https://example.com/a.png\">{{stat_data.角色.好感度}}\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: false },
      html: { statusbar: { enabled: true, html: "../source/html/statusbar.html" } },
      regex: {},
      ejs: { enabled: false, entries: [] },
    });

    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "html.script_forbidden")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "html.external_url")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "html.naked_stat_data_macro")).toBe(true);
  });

  it("rejects draft references that point outside their required source directories", async () => {
    const { project } = await createTestProject("v5-mvp-source-reference-rules", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "你好\n");
    await writeSource(project.slug, "entries/world.xyaml", "世界\n");
    await writeSource(project.slug, "fields/wrong-entry.xyaml", "错误目录\n");
    await writeSource(project.slug, "html/statusbar.css", ".bar{}\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "wrong-dir",
        comment: "错误目录",
        content: "../source/fields/wrong-entry.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "after_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });
    await writeDraft(project, "assets", {
      mvu: { enabled: false },
      html: { statusbar: { enabled: true, html: "../source/html/missing.html", css: "../source/entries/world.xyaml" } },
      regex: { scripts: "../source/html/statusbar.css" },
      ejs: { enabled: false, entries: [{ id: "bad-ejs", file: "../source/regex/scripts.yaml" }] },
    });

    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "source_reference.wrong_directory" && issue.field === "worldbook.entries.0.content")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "path.missing" && issue.field === "html.statusbar.html")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "source_reference.wrong_directory" && issue.field === "html.statusbar.css")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "source_reference.wrong_directory" && issue.field === "regex.scripts")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "source_reference.wrong_directory" && issue.field === "ejs.entries.0.file")).toBe(true);
  });

  it("reports malformed plan entries yaml as a validation issue", async () => {
    const { project } = await createTestProject("v5-mvp-bad-plan-yaml", "worldbook");
    await writePlan(project, "# 创作计划\n\n```yaml\nentries:\n  - id: broken\n    source: [\n```\n");
    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "plan.entries.invalid_yaml")).toBe(true);
    await expect(resumeProject(project)).resolves.toMatchObject({ ok: true });
  });

  it("rejects invalid regex scripts schema during validation", async () => {
    const { project } = await createTestProject("v5-mvp-invalid-regex-schema", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "你好\n");
    await writeSource(project.slug, "regex/scripts.yaml", "- name: 缺少查找表达式\n  replaceString: x\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: false },
      html: { statusbar: { enabled: false } },
      regex: { scripts: "../source/regex/scripts.yaml" },
      ejs: { enabled: false, entries: [] },
    });
    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "regex.scripts.schema_invalid")).toBe(true);
  });

  it("rejects mvu/ejs inconsistent assets and warns about stat_data-root initvar", async () => {
    const { project } = await createTestProject("v5-mvp-mvu-rules", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n");
    await writeSource(project.slug, "mvu/schema.js", "export const Schema = z.object({});\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "stat_data:\n  hp: 10\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "hp: 可变化\n");
    await writeSource(project.slug, "mvu/variable-list.md", "- hp\n");
    await writeSource(project.slug, "mvu/output-format.md", "<UpdateVariable/>\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" },
      html: { statusbar: { enabled: false } },
      regex: {},
      ejs: { enabled: true, entries: [] },
    });

    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code === "mvu.initvar.stat_data_root" && issue.severity === "warning")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "assets.ejs_requires_mvu")).toBe(false);
  });

  it("reports workspace/project mismatches", async () => {
    const { project } = await createTestProject("v5-mvp-workspace-mismatch");
    const workspace = await readYamlFile(WORKSPACE_PATH, undefined as any);
    await writeYamlFile(WORKSPACE_PATH, { ...(workspace as any), projects: (workspace as any).projects.filter((entry: any) => entry.slug !== project.slug) });

    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "workspace.project_missing")).toBe(true);
  });

  it("writes validation-report.md with issue codes", async () => {
    const { project } = await createTestProject("v5-mvp-validation-report", "worldbook");
    const report = await validateProject(project);
    const reportPath = await writeValidationMarkdownReport(project, report);
    const content = await fs.readFile(reportPath, "utf8");
    expect(content).toContain("Validation Report");
    expect(content).toContain("worldbook.entries.empty");
  });

  it("rejects ejs when mvu is disabled", async () => {
    const { project } = await createTestProject("v5-mvp-ejs-needs-mvu", "character_card");
    await writeDraft(project, "assets", {
      mvu: { enabled: false },
      html: { statusbar: { enabled: false } },
      regex: {},
      ejs: { enabled: true, entries: [] },
    });

    const report = await validateProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "assets.ejs_requires_mvu")).toBe(true);
  });
});

describe("v5 builders", () => {
  it("builds worldbook json and character card json with empty descriptions", async () => {
    const { project } = await createTestProject("v5-mvp-build-card");
    await writeSource(project.slug, "fields/first_mes.md", "初次见面，{{user}}。\n");
    await writeSource(project.slug, "fields/personality.md", "温和而谨慎\n");
    await writeSource(project.slug, "fields/scenario.md", "雨夜车站\n");
    await writeSource(project.slug, "fields/mes_example.md", "");
    await writeSource(project.slug, "fields/creator_notes.md", "");
    await writeSource(project.slug, "fields/system_prompt.md", "");
    await writeSource(project.slug, "fields/post_history_instructions.md", "");
    await writeSource(project.slug, "entries/heroine.xyaml", "<character>角色设定</character>\n");

    const worldbook = WorldbookDraftSchema.parse({
      name: project.name,
      entries: [{
        id: "heroine-basic",
        comment: "女主基础信息",
        type: "character_basic",
        content: "../source/entries/heroine.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "after_char",
        order: 10,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });
    await writeDraft(project, "worldbook", worldbook);

    const card = (await readDraft(project)).card!;
    const worldbookJson = await buildWorldbookJson(project, worldbook);
    const cardJson = await buildCharacterCardJson(project, card, worldbook, undefined, "2026-01-01T00:00:00.000Z") as Record<string, any>;

    expect((worldbookJson as any).entries["0"].content).toContain("角色设定");
    expect(cardJson.description).toBe("");
    expect(cardJson.data.description).toBe("");
    expect(cardJson.data.first_mes).toContain("{{user}}");
    expect(cardJson.data.character_book.entries).toHaveLength(1);
  });

  it("generates json files into project exports", async () => {
    const { project } = await createTestProject("v5-mvp-generate-worldbook", "worldbook");
    await writeSource(project.slug, "entries/world.xyaml", "<world>可导出</world>\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "world",
        comment: "世界",
        content: "../source/entries/world.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "before_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });

    const result = await generateJson(project, { target: "worldbook", overwrite: true });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].path).toContain(path.join(".worldbook", "projects", project.slug, "exports"));
    await expect(fs.access(result.outputs[0].path)).resolves.toBeUndefined();
    await expect(fs.access(result.report_path)).resolves.toBeUndefined();
  });

  it("generates both card and worldbook outputs with custom relative output paths", async () => {
    const { project } = await createTestProject("v5-mvp-generate-both", "both");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n{{user}} 来到了门前。\n");
    await writeSource(project.slug, "fields/personality.md", "冷静\n");
    await writeSource(project.slug, "fields/scenario.md", "庭院\n");
    await writeSource(project.slug, "fields/mes_example.md", "");
    await writeSource(project.slug, "fields/creator_notes.md", "");
    await writeSource(project.slug, "fields/system_prompt.md", "");
    await writeSource(project.slug, "fields/post_history_instructions.md", "");
    await writeSource(project.slug, "entries/world.xyaml", "<world>双输出世界</world>\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "world",
        comment: "世界",
        content: "../source/entries/world.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "before_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });

    const result = await generateJson(project, { target: "both", overwrite: true, output_paths: { worldbook: "custom/world.json", character_card: "custom/card.json" } });
    expect(result.outputs.map((output) => output.target).sort()).toEqual(["character_card", "worldbook"]);
    expect(result.outputs.every((output) => output.path.includes(path.join("exports", "custom")))).toBe(true);
    for (const output of result.outputs) await expect(fs.access(output.path)).resolves.toBeUndefined();
    await expect(generateJson(project, { target: "both", output_path: "single.json", force: true })).rejects.toThrow("target=both");

    const cardOutput = result.outputs.find((output) => output.target === "character_card")!;
    const cardJson = JSON.parse(await fs.readFile(cardOutput.path, "utf8"));
    expect(cardJson.description).toBe("");
    expect(cardJson.data.description).toBe("");
    expect(cardJson.data.character_book.entries).toHaveLength(1);
  });

  it("rejects generate_json output paths outside project exports", async () => {
    const { project } = await createTestProject("v5-mvp-generate-path-reject", "worldbook");
    await writeSource(project.slug, "entries/world.xyaml", "<world>越界测试</world>\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "world",
        comment: "世界",
        content: "../source/entries/world.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "before_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });

    await expect(generateJson(project, { target: "worldbook", output_path: "../escape.json" })).rejects.toThrow("路径不允许越界");
    await expect(generateJson(project, { target: "worldbook", output_path: path.resolve(projectDir(project.slug), "exports/abs.json") })).rejects.toThrow("导出路径必须是相对 exports/ 的路径");
  });

  it("injects regex, mvu, html and ejs assets into generated card/worldbook data", async () => {
    const { project } = await createTestProject("v5-mvp-generate-assets", "both");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n{{user}} 查看状态栏。\n");
    await writeSource(project.slug, "fields/personality.md", "沉着\n");
    await writeSource(project.slug, "fields/scenario.md", "状态测试\n");
    await writeSource(project.slug, "fields/mes_example.md", "");
    await writeSource(project.slug, "fields/creator_notes.md", "");
    await writeSource(project.slug, "fields/system_prompt.md", "");
    await writeSource(project.slug, "fields/post_history_instructions.md", "");
    await writeSource(project.slug, "entries/world.xyaml", "<world>资产世界</world>\n");
    await writeSource(project.slug, "mvu/schema.js", "export const Schema = z.object({ hp: z.number() });\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "hp: 10\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "hp: 根据剧情变化\n");
    await writeSource(project.slug, "mvu/variable-list.md", "- stat_data.hp\n");
    await writeSource(project.slug, "mvu/output-format.md", "<UpdateVariable>{{stat_data.hp}}</UpdateVariable>\n");
    await writeSource(project.slug, "html/statusbar.html", "<div>{{format_message_variable::stat_data.hp}}</div>\n");
    await writeSource(project.slug, "html/statusbar.css", ".bar { color: red; }\n");
    await writeSource(project.slug, "regex/scripts.yaml", "- id: custom-regex\n  name: 自定义正则\n  findRegex: foo\n  replaceString: bar\n  markdownOnly: true\n  promptOnly: false\n  placement: [2]\n  minDepth: null\n  maxDepth: null\n  runOnEdit: false\n  substituteRegex: 0\n  disabled: false\n");
    await writeSource(project.slug, "ejs/controller.ejs", "<% /* controller */ %>\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{
        id: "world",
        comment: "世界",
        content: "../source/entries/world.xyaml",
        enabled: true,
        constant: true,
        keys: [],
        secondary_keys: [],
        position: "before_char",
        order: 1,
        depth: 4,
        scanDepth: null,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    });
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md", hideRegex: true },
      html: { statusbar: { enabled: true, html: "../source/html/statusbar.html", css: "../source/html/statusbar.css" } },
      regex: { scripts: "../source/regex/scripts.yaml" },
      ejs: { enabled: true, entries: [{ id: "controller", file: "../source/ejs/controller.ejs", role: "controller", enabled: true, position: "at_depth", order: 16000, depth: 0 }] },
    });

    const result = await generateJson(project, { target: "both", overwrite: true });
    const cardPath = result.outputs.find((output) => output.target === "character_card")!.path;
    const worldbookPath = result.outputs.find((output) => output.target === "worldbook")!.path;
    const cardJson = JSON.parse(await fs.readFile(cardPath, "utf8"));
    const worldbookJson = JSON.parse(await fs.readFile(worldbookPath, "utf8"));
    const regexNames = cardJson.data.extensions.regex_scripts.map((script: any) => script.scriptName);
    const helperNames = cardJson.data.extensions.TavernHelper_scripts.map((script: any) => script.value.name);
    const worldbookContents = Object.values(worldbookJson.entries).map((entry: any) => entry.content).join("\n");

    expect(regexNames).toContain("[不发送]去除变量更新");
    expect(regexNames).toContain("[不发送]界面占位符");
    expect(regexNames).toContain("[界面]状态栏");
    expect(regexNames).toContain("自定义正则");
    expect(cardJson.data.extensions.regex_scripts.find((script: any) => script.scriptName === "[界面]状态栏").replaceString).toContain("format_message_variable::stat_data.hp");
    expect(helperNames).toContain("MVU Zod 脚本");
    expect(helperNames).toContain("变量结构设计");
    expect(worldbookContents).toContain("资产世界");
    expect(worldbookContents).toContain("hp: 10");
    expect(worldbookContents).toContain("<% /* controller */ %>");
  });
});

describe("v5 import", () => {
  it("imports a worldbook json into source files and worldbook draft", async () => {
    const name = "v5-mvp-import-worldbook";
    await cleanup(name);
    const inputPath = path.resolve(process.cwd(), ".worldbook", "tmp-import-worldbook.json");
    await fs.mkdir(path.dirname(inputPath), { recursive: true });
    await fs.writeFile(inputPath, JSON.stringify({ name, entries: { "0": { comment: "导入条目", content: "导入内容", key: ["触发"], keysecondary: [], position: 1, order: 3, depth: 4, constant: false } } }), "utf8");

    const result = await importExistingJson(inputPath, undefined, "overwrite");
    const project = await readProjectBySlug(name);
    const draft = await readDraft(project);

    expect(result.ok).toBe(true);
    expect(draft.worldbook?.entries).toHaveLength(1);
    expect(draft.worldbook?.entries[0].keys).toEqual(["触发"]);
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "entries", "001-导入条目.xyaml"), "utf8")).resolves.toBe("导入内容");
    await fs.rm(inputPath, { force: true });
  });

  it("imports card description as a worldbook entry and keeps card description empty", async () => {
    const name = "v5-mvp-import-card";
    await cleanup(name);
    const inputPath = path.resolve(process.cwd(), ".worldbook", "tmp-import-card.json");
    await fs.mkdir(path.dirname(inputPath), { recursive: true });
    await fs.writeFile(inputPath, JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name,
        description: "原 description 人设",
        personality: "旧卡性格",
        scenario: "旧卡背景",
        first_mes: "你好",
        character_book: { name, entries: [{ comment: "角色条目", content: "角色内容", keys: ["角色"], secondary_keys: [], extensions: { position: 1, depth: 4 }, insertion_order: 5, constant: true, enabled: true }] },
      },
    }), "utf8");

    await importExistingJson(inputPath, undefined, "overwrite");
    const project = await readProjectBySlug(name);
    const draft = await readDraft(project);

    expect(draft.card?.description).toBe("");
    expect(draft.card?.personality).toBe("");
    expect(draft.card?.scenario).toBe("");
    expect(draft.worldbook?.entries.some((entry) => entry.id === "imported-description")).toBe(true);
    expect(draft.worldbook?.entries.some((entry) => entry.id === "imported-personality")).toBe(true);
    expect(draft.worldbook?.entries.some((entry) => entry.id === "imported-scenario")).toBe(true);
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "entries", "000-imported-description.xyaml"), "utf8")).resolves.toBe("原 description 人设");
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "entries", "001-imported-personality.xyaml"), "utf8")).resolves.toBe("旧卡性格");
    await fs.rm(inputPath, { force: true });
  });

  it("imports legacy MVU worldbook entries into source/mvu and assets draft", async () => {
    const name = "v5-mvp-import-mvu-entries";
    await cleanup(name);
    const inputPath = path.resolve(process.cwd(), ".worldbook", "tmp-import-mvu-entries.json");
    await fs.mkdir(path.dirname(inputPath), { recursive: true });
    await fs.writeFile(inputPath, JSON.stringify({ name, entries: {
      "0": { comment: "[initvar]变量初始化", content: "hp: 10" },
      "1": { comment: "变量列表", content: "hp" },
      "2": { comment: "[mvu_update]变量更新规则", content: "hp: 变化" },
      "3": { comment: "[mvu_update]变量输出格式", content: "<UpdateVariable/>" },
      "4": { comment: "普通条目", content: "普通内容", key: [], position: 1, order: 1, constant: true },
    } }), "utf8");

    await importExistingJson(inputPath, undefined, "overwrite");
    const project = await readProjectBySlug(name);
    const draft = await readDraft(project);

    expect(draft.assets?.mvu.enabled).toBe(true);
    expect(draft.worldbook?.entries).toHaveLength(1);
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "mvu", "initvar.yaml"), "utf8")).resolves.toBe("hp: 10");
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "mvu", "output-format.md"), "utf8")).resolves.toBe("<UpdateVariable/>");
    await fs.rm(inputPath, { force: true });
  });

  it("imports card regex statusbar and TavernHelper MVU schema into v5 assets", async () => {
    const name = "v5-mvp-import-assets";
    await cleanup(name);
    const inputPath = path.resolve(process.cwd(), ".worldbook", "tmp-import-assets-card.json");
    await fs.mkdir(path.dirname(inputPath), { recursive: true });
    await fs.writeFile(inputPath, JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name,
        description: "",
        first_mes: "<StatusPlaceHolderImpl/>",
        extensions: {
          regex_scripts: [
            { id: "status", scriptName: "[界面]状态栏", findRegex: "<StatusPlaceHolderImpl/>", replaceString: "<style>.x{}</style><![CDATA[<div>{{stat_data.hp}}</div>]]>", markdownOnly: true, promptOnly: false, placement: [2] },
            { id: "custom", scriptName: "自定义", findRegex: "foo", replaceString: "bar", markdownOnly: true, promptOnly: false, placement: [2] },
          ],
          TavernHelper_scripts: [{ type: "script", value: { name: "变量结构设计", content: "export const Schema = z.object({ hp: z.number() });" } }],
        },
        character_book: { name, entries: [] },
      },
    }), "utf8");

    await importExistingJson(inputPath, undefined, "overwrite");
    const project = await readProjectBySlug(name);
    const draft = await readDraft(project);

    expect(draft.assets?.html.statusbar.enabled).toBe(true);
    expect(draft.assets?.regex.scripts).toBe("../source/regex/scripts.yaml");
    expect(draft.assets?.mvu.enabled).toBe(true);
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "html", "statusbar.html"), "utf8")).resolves.toContain("{{stat_data.hp}}");
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source", "mvu", "schema.js"), "utf8")).resolves.toContain("export const Schema");
    await fs.rm(inputPath, { force: true });
  });
});


describe("v5 skill-authored content and structural helpers", () => {
  it("lets Skill-authored character/worldbuilding content land through source and configure_draft", async () => {
    const { project } = await createTestProject("v5-mvp-skill-authored-content", "worldbook");
    await writeSource(project.slug, "entries/character-palette-hero.xyaml", "<character_palette id=\"hero\">\npersonality_palette:\n  base_color: 好奇\n  derivations:\n    - color: 好奇\n      items:\n        - 看到陌生机关时会先绕一圈观察\n        - 听到禁忌传闻会记下具体地点\n</character_palette>\n");
    await writeSource(project.slug, "entries/001-world-summary.xyaml", "<world_summary>\nclass: C_large_world\nconcept_anchors:\n  - name: 潮汐门\n    what: 只在退潮时开启的门\n    who_uses_it: 走私者\n    why_it_matters: 决定角色能否逃离\n</world_summary>\n");
    await configureDraft(project, { mode: "apply", entries: [
      { id: "character-palette-hero", comment: "主角调色盘", type: "character_personality", content: "../source/entries/character-palette-hero.xyaml", part: "hero.palette", scope: "catalog", status: "drafted", abstract: "主角调色盘" },
      { id: "world-summary", comment: "世界观总纲", type: "world_summary", content: "../source/entries/001-world-summary.xyaml", part: "world.summary", scope: "catalog", status: "drafted", abstract: "世界观总纲" },
    ] });
    const draft = await readDraft(project);
    expect(draft.worldbook?.entries.some((entry) => entry.id === "character-palette-hero" && entry.part === "hero.palette")).toBe(true);
    expect(draft.worldbook?.entries.some((entry) => entry.id === "world-summary" && entry.type === "world_summary")).toBe(true);
  });

  it("creates ejs stage template with controller enabled and stages disabled", async () => {
    const { project } = await createTestProject("v5-mvp-ejs-stage-template", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "你好，{{user}}。\n");
    const input = { variable: "stat_data.phase", base_profile: "", common_derivations: [], stages: [{ id: "intro", label: "序章", value: "intro" }, { id: "trust", label: "信任", value: "trust" }] };
    const result = await createEjsStageTemplate(project, input);
    const draft = await readDraft(project);
    expect(result.files.some((file) => file.includes("stage-controller.ejs"))).toBe(true);
    expect(draft.assets?.mvu.enabled).toBe(true);
    expect(draft.assets?.ejs.enabled).toBe(true);
    expect(draft.assets?.ejs.entries.find((entry) => entry.role === "controller")?.enabled).toBe(true);
    expect(draft.assets?.ejs.entries.filter((entry) => entry.role === "stage").every((entry) => entry.enabled === false)).toBe(true);
    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code === "assets.ejs_requires_mvu")).toBe(false);
    const card = await buildCharacterCardJson(project, draft.card!, draft.worldbook, draft.assets, new Date().toISOString()) as any;
    expect(card.data.character_book.entries.some((entry: any) => String(entry.comment).includes("stage-controller"))).toBe(true);
    expect(card.data.character_book.entries.some((entry: any) => String(entry.comment).includes("stage-intro"))).toBe(false);
    const stageText = await fs.readFile(path.resolve(projectDir(project.slug), "source/ejs/stage-intro.ejs"), "utf8");
    expect(stageText).toContain("stage_profile");
    await expect(createEjsStageTemplate(project, input)).rejects.toThrow();
    await expect(createEjsStageTemplate(project, { ...input, overwrite: true })).resolves.toMatchObject({ ok: true });
  });
});


describe("v5 entry manifest and sync bridge", () => {
  it("updates and queries entry manifest status", async () => {
    const { project } = await createTestProject("v5-mvp-entry-manifest", "worldbook");
    await writeSource(project.slug, "entries/world.xyaml", "世界\n");
    await writeSource(project.slug, "references/chapter-01.md", "原文\n");
    await writeDraft(project, "worldbook", { name: project.name, entries: [{ id: "world", comment: "世界", content: "../source/entries/world.xyaml", enabled: true, constant: true, keys: [], secondary_keys: [], position: "before_char", order: 1, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true }] });

    await updateEntryStatus(project, "world", { status: "drafted", abstract: "世界摘要", sourceRefs: ["source/references/chapter-01.md"], part: "world", scope: "catalog" });
    const queried = await queryEntries(project, { status: "drafted", include_content: true });
    expect(queried.entries).toHaveLength(1);
    expect((queried.entries[0] as any).abstract).toBe("世界摘要");
    expect((queried.entries[0] as any).text).toContain("世界");
    expect((queried.summary as any).by_status.drafted).toBe(1);
  });

  it("reads source files safely and resumes project progress from plan entries", async () => {
    const { project } = await createTestProject("v5-mvp-resume-project", "worldbook");
    await writeSource(project.slug, "entries/world.xyaml", "世界内容\n");
    await writePlan(project, `# 创作计划\n\n\`\`\`yaml\nentries:\n  - id: world\n    source: source/entries/world.xyaml\n    status: drafted\n  - id: missing\n    source: source/entries/missing.xyaml\n\`\`\`\n`);
    await writeDraft(project, "worldbook", { name: project.name, entries: [{ id: "world", comment: "世界", content: "../source/entries/world.xyaml", enabled: true, constant: true, keys: [], secondary_keys: [], position: "before_char", order: 1, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true, abstract: "摘要", status: "drafted" }] });

    const source = await readSourceFile(project, "entries/world.xyaml", 4);
    expect(source.content).toBe("世界内容".slice(0, 4));
    expect(source.truncated).toBe(true);
    await expect(readSourceFile(project, "../draft/worldbook.yaml")).rejects.toThrow();

    const resume = await resumeProject(project) as any;
    expect(resume.progress.entries.plan_compare.missing_in_draft.some((entry: any) => entry.id === "missing")).toBe(true);
    const validation = await validateProject(project);
    expect(validation.issues.some((issue) => issue.code === "plan.entry.missing_in_draft")).toBe(true);
  });

  it("checks delivery gates from build-report outputs and detects stale builds", async () => {
    const { project } = await createTestProject("v5-mvp-check-delivery-中文", "worldbook");
    await writeSource(project.slug, "entries/world.xyaml", "世界\n");
    await writeDraft(project, "worldbook", { name: project.name, entries: [{ id: "world", comment: "世界", content: "../source/entries/world.xyaml", enabled: true, constant: true, keys: [], secondary_keys: [], position: "before_char", order: 1, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true, status: "planned" }] });
    const before = await checkDelivery(project, { require_done_entries: true }) as any;
    expect(before.ok).toBe(false);
    expect(before.blocking.some((item: string) => item.includes("missing build-report.yaml"))).toBe(true);
    await generateJson(project, { target: "worldbook", overwrite: true, output_path: "custom/world.json", force: true });
    const after = await checkDelivery(project) as any;
    expect(after.blocking.some((item: string) => item.includes("missing worldbook export"))).toBe(false);
    expect(after.paths.exports[0].path).toContain(path.join("exports", "custom", "world.json"));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await writeSource(project.slug, "entries/world.xyaml", "世界已修改\n");
    const stale = await checkDelivery(project) as any;
    expect(stale.blocking.some((item: string) => item.includes("build is stale"))).toBe(true);
  });

  it("validates derivative sourceRefs and generates tavern sync config", async () => {
    const created = await createProject({ name: "v5-mvp-sync-config", output: "worldbook", source: "derivative", ifExists: "overwrite" });
    const project = created.project;
    await writeSource(project.slug, "entries/world.xyaml", "世界\n");
    await writeSource(project.slug, "references/chapter-01.md", "原文\n");
    await writeDraft(project, "worldbook", { name: project.name, entries: [{ id: "world", comment: "世界", content: "../source/entries/world.xyaml", enabled: true, constant: true, keys: [], secondary_keys: [], position: "before_char", order: 1, depth: 4, scanDepth: null, preventRecursion: true, excludeRecursion: true, abstract: "摘要", sourceRefs: ["source/references/chapter-01.md"] }] });

    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code === "worldbook.entry.source_refs_missing")).toBe(false);
    const sync = await generateTavernSyncConfig(project, { user_name: "{{user}}", overwrite: true });
    const content = await fs.readFile(sync.path, "utf8");
    expect(content).toContain("user名称");
    expect(content).toContain("酒馆中的名称");
    await expect(generateTavernSyncConfig(project, { output_path: "../escape.yaml", overwrite: true })).rejects.toThrow("路径不允许越界");
    await expect(generateTavernSyncConfig(project, { output_path: path.resolve(projectDir(project.slug), "reports/abs.yaml"), overwrite: true })).rejects.toThrow("报告路径必须是相对 reports/ 的路径");
  });
});


describe("v5 compatibility import and advanced assets", () => {
  it("imports nova config yaml into v5 project", async () => {
    const tempDir = path.resolve(process.cwd(), ".worldbook", "tmp-nova-import");
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.resolve(tempDir, "first.md"), "你好，{{user}}。\n", "utf8");
    await fs.writeFile(path.resolve(tempDir, "desc.md"), "原 description 人设。\n", "utf8");
    await fs.writeFile(path.resolve(tempDir, "personality.md"), "性格内容。\n", "utf8");
    await fs.writeFile(path.resolve(tempDir, "entry.xyaml"), "<world>世界条目</world>\n", "utf8");
    await fs.writeFile(path.resolve(tempDir, "status.html"), "<div>{{format_message_variable::stat_data.hp}}</div>\n", "utf8");
    await fs.writeFile(path.resolve(tempDir, "schema.js"), "export const Schema = z.object({ hp: z.number() });\n", "utf8");
    const configPath = path.resolve(tempDir, "nova.yaml");
    await fs.writeFile(configPath, "name: Nova导入测试\ncreator: Nova\ncharacter_version: '1.0'\nfields:\n  description: desc.md\n  personality: personality.md\n  first_mes: first.md\nextensions:\n  talkativeness: '0.7'\n  fav: true\n  status_bar: status.html\nscripts:\n  - name: 变量结构设计\n    content: schema.js\n    enabled: true\ncharacter_book:\n  name: Nova世界书\n  entries:\n    - comment: 世界条目\n      content: entry.xyaml\n      enabled: true\n      position: before_char\n      insertion_order: 10\n      depth: 4\n", "utf8");

    const result = await importNovaConfig(configPath, undefined, "overwrite");
    const project = await readProjectBySlug("nova导入测试");
    const draft = await readDraft(project);
    expect(result.ok).toBe(true);
    expect(draft.card?.description).toBe("");
    expect(draft.card?.first_mes).toBe("../source/fields/first_mes.md");
    expect(draft.worldbook?.entries.some((entry) => entry.id === "nova-description")).toBe(true);
    expect(draft.worldbook?.entries.some((entry) => entry.id === "nova-personality")).toBe(true);
    expect(draft.worldbook?.entries.some((entry) => entry.comment === "世界条目")).toBe(true);
    expect(draft.assets?.html.statusbar.enabled).toBe(true);
    expect(draft.assets?.mvu.enabled).toBe(true);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("supports regex replaceFile and dynamic_js statusbar mode", async () => {
    const { project } = await createTestProject("v5-mvp-replace-file-dynamic-js", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n");
    await writeSource(project.slug, "html/statusbar.html", "<script>var all=getAllVariables();</script><div>ok</div>\n");
    await writeSource(project.slug, "regex/replace.html", "<strong>替换内容</strong>\n");
    await writeSource(project.slug, "regex/scripts.yaml", "- name: file-regex\n  findRegex: PLACEHOLDER\n  replaceString: inline\n  replaceFile: ../regex/replace.html\n  markdownOnly: true\n  promptOnly: false\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: false },
      html: { statusbar: { enabled: true, html: "../source/html/statusbar.html", mode: "dynamic_js" } },
      regex: { scripts: "../source/regex/scripts.yaml" },
      ejs: { enabled: false, entries: [] },
    });

    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code === "html.script_forbidden")).toBe(false);
    expect(report.issues.some((issue) => issue.code === "html.dynamic_js.error_guard_missing")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "regex.replace_file_overrides_string")).toBe(true);
    const card = await buildCharacterCardJson(project, (await readDraft(project)).card!, (await readDraft(project)).worldbook, (await readDraft(project)).assets, new Date().toISOString()) as any;
    const regex = card.data.extensions.regex_scripts.find((script: any) => script.scriptName === "file-regex");
    expect(regex.replaceString).toContain("替换内容");
  });
});


describe("v5 configure, repair and mvu validation", () => {
  it("previews and applies inferred worldbook draft entries", async () => {
    const { project } = await createTestProject("v5-mvp-configure-draft", "worldbook");
    const preview = await configureDraft(project, { mode: "preview", entries: [{ id: "heroine", comment: "女主性格", type: "character_personality", content: "../source/entries/heroine.xyaml", strategy: "green" }] });
    expect(preview.entries).toHaveLength(1);
    expect((preview.entries[0] as any).constant).toBe(false);
    expect((preview.entries[0] as any).keys).toEqual(["女主性格"]);
    expect((await readDraft(project)).worldbook?.entries).toHaveLength(0);

    await configureDraft(project, { mode: "apply", entries: [{ id: "world", comment: "世界观", type: "world_summary", content: "../source/entries/world.xyaml", strategy: "blue" }] });
    const draft = await readDraft(project);
    expect(draft.worldbook?.entries).toHaveLength(1);
    expect(draft.worldbook?.entries[0].position).toBe("before_char");
    expect(draft.worldbook?.entries[0].preventRecursion).toBe(true);

    await expect(configureDraft(project, { mode: "preview", entries: [{ id: "world", comment: "重复", content: "../source/entries/other.xyaml" }] })).rejects.toThrow("世界书条目 id 已存在");
    await expect(configureDraft(project, { mode: "preview", entries: [{ id: "bad", comment: "坏路径", content: "../source/fields/bad.md" }] })).rejects.toThrow("content 必须引用 source/entries");
  });

  it("auto-configures threshold entries based on previous same-group entries only", async () => {
    const { project } = await createTestProject("v5-mvp-configure-threshold", "worldbook");
    const result = await configureDraft(project, {
      mode: "preview",
      strategy: "auto",
      strategyThresholds: { character_personality: 2 },
      entries: [
        { id: "a", comment: "角色A", type: "character_personality", part: "cast", content: "../source/entries/a.xyaml" },
        { id: "b", comment: "角色B", type: "character_personality", part: "cast", content: "../source/entries/b.xyaml" },
        { id: "c", comment: "角色C", type: "character_personality", part: "cast", content: "../source/entries/c.xyaml" },
      ],
    });
    const entries = result.entries as any[];
    expect(entries.map((entry) => entry.constant)).toEqual([true, true, false]);
  });

  it("auto-configures entries with profile, scope, rephrase and grouped orders", async () => {
    const { project } = await createTestProject("v5-mvp-configure-auto", "worldbook");
    const result = await configureDraft(project, {
      mode: "preview",
      strategy: "auto",
      profile: "multi_character",
      partOrder: { overview: 1, heroine: 3, rephrase: 90 },
      requiredParts: ["overview", "missing"],
      entries: [
        { id: "overview", comment: "角色速览", type: "character_overview", part: "overview", scope: "catalog", content: "../source/entries/overview.xyaml" },
        { id: "heroine", comment: "女主性格", type: "character_personality", part: "heroine", content: "../source/entries/heroine.xyaml" },
        { id: "rephrase", comment: "二次解释", type: "style", rephrase: true, content: "../source/entries/rephrase.xyaml" },
      ],
    });
    const entries = result.entries as any[];
    expect(entries[0].constant).toBe(true);
    expect(entries[0].order).toBe(10);
    expect(entries[1].constant).toBe(false);
    expect(entries[1].keys).toEqual(["女主性格"]);
    expect(entries[1].order).toBe(30);
    expect(entries[2].position).toBe("at_depth");
    expect(entries[2].depth).toBe(0);
    expect(entries[2].order).toBe(900);
    expect(result.actions.some((action) => action.code === "configure.required_part_missing")).toBe(true);
  });

  it("repairs html naked stat_data macros and mvu stat_data root", async () => {
    const { project } = await createTestProject("v5-mvp-repair", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "<StatusPlaceHolderImpl/>\n");
    await writeSource(project.slug, "entries/green.xyaml", "绿灯\n");
    await writeSource(project.slug, "html/statusbar.html", "<![CDATA[<div>{{stat_data.hp}}</div>]]>\n");
    await writeSource(project.slug, "mvu/schema.js", "export const Schema = z.object({ hp: z.number() });\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "stat_data:\n  hp: 10\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "hp: 变化\n");
    await writeSource(project.slug, "mvu/variable-list.md", "hp\n");
    await writeSource(project.slug, "mvu/output-format.md", "hp\n");
    await writeDraft(project, "worldbook", {
      name: project.name,
      entries: [{ id: "green", comment: "绿灯", content: "../source/entries/green.xyaml", enabled: true, constant: false, keys: [], secondary_keys: [], position: "after_char", order: 1, depth: 4, scanDepth: 2, preventRecursion: true, excludeRecursion: true }],
    });
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" },
      html: { statusbar: { enabled: true, html: "../source/html/statusbar.html" } },
      regex: {},
      ejs: { enabled: false, entries: [] },
    });

    const result = await repairProject(project);
    const repairedDraft = await readDraft(project);
    const html = await fs.readFile(path.resolve(projectDir(project.slug), "source/html/statusbar.html"), "utf8");
    const initvar = await fs.readFile(path.resolve(projectDir(project.slug), "source/mvu/initvar.yaml"), "utf8");

    expect(result.actions.map((action) => action.code)).toContain("worldbook.green_keys.fixed");
    expect(result.actions.map((action) => action.code)).toContain("html.cdata.unwrapped");
    expect(result.actions.map((action) => action.code)).toContain("html.naked_stat_data.fixed");
    expect(result.actions.map((action) => action.code)).toContain("mvu.initvar.stat_data_root.fixed");
    expect(repairedDraft.worldbook?.entries[0].keys).toEqual(["绿灯"]);
    expect(html).toContain("format_message_variable::stat_data.hp");
    expect(initvar).toBe("hp: 10\n");
  });

  it("repairs schema-invalid card description and worldbook recursion flags", async () => {
    const { project } = await createTestProject("v5-mvp-repair-invalid-draft", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "你好\n");
    await writeSource(project.slug, "entries/green.xyaml", "绿灯\n");
    await fs.writeFile(draftPath(project, "card"), "name: 坏卡\ndescription: 非空描述\nfirst_mes: ../source/fields/first_mes.md\n", "utf8");
    await fs.writeFile(draftPath(project, "worldbook"), "name: 坏卡\nentries:\n  - id: green\n    comment: 绿灯\n    content: ../source/entries/green.xyaml\n    enabled: true\n    constant: false\n    keys: []\n    secondary_keys: []\n    position: after_char\n    order: 1\n    depth: 4\n    scanDepth: 2\n    preventRecursion: false\n    excludeRecursion: false\n", "utf8");

    const result = await repairProject(project);
    const repaired = await readDraft(project);

    expect(result.actions.map((action) => action.code)).toContain("card.description.moved_to_worldbook");
    expect(result.actions.map((action) => action.code)).toContain("worldbook.double_recursion.fixed");
    expect(repaired.card?.description).toBe("");
    expect(repaired.worldbook?.entries.some((entry) => entry.id === "repaired-description")).toBe(true);
    expect(repaired.worldbook?.entries.find((entry) => entry.id === "green")?.preventRecursion).toBe(true);
  });

  it("applies mvu preset and edits variables through v5 tools", async () => {
    const { project } = await createTestProject("v5-mvp-mvu-variable-tools", "character_card");
    const preset = await applyMvuPreset(project, { preset: "minimal", overwrite: true });
    expect(preset.files.length).toBeGreaterThan(0);
    expect((await readDraft(project)).assets?.mvu.enabled).toBe(true);

    await rewriteMvuVariables(project, [
      { path: ["角色A", "好感度"], kind: "number", defaultValue: 0, description: "角色A对{{user}}的好感度", min: 0, max: 100 },
      { path: ["世界", "阶段"], kind: "string", defaultValue: "序章" },
    ]);
    let listed = await listMvuVariables(project);
    expect(listed.variables.map((item) => item.dotPath)).toContain("角色A.好感度");
    await expect(fs.readFile(path.resolve(projectDir(project.slug), "source/mvu/schema.js"), "utf8")).resolves.toContain("_.clamp");

    await upsertMvuVariable(project, { path: ["角色A", "在场"], kind: "boolean", defaultValue: true });
    listed = await listMvuVariables(project);
    expect(listed.variables.map((item) => item.dotPath)).toContain("角色A.在场");

    await removeMvuVariable(project, ["世界", "阶段"]);
    listed = await listMvuVariables(project);
    expect(listed.variables.map((item) => item.dotPath)).not.toContain("世界.阶段");
  });

  it("validates ejs preprocess and condition lint warnings", async () => {
    const { project } = await createTestProject("v5-mvp-ejs-preprocess-lint", "character_card");
    await writeSource(project.slug, "fields/first_mes.md", "你好\n");
    await writeSource(project.slug, "mvu/schema.js", "export const Schema = z.object({ phase: z.string() });\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "phase: start\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "phase: 更新\n");
    await writeSource(project.slug, "mvu/variable-list.md", "phase\n");
    await writeSource(project.slug, "mvu/output-format.md", "phase\n");
    await writeSource(project.slug, "ejs/preprocess.ejs", "@@generate_before\nvar phase = getvar('stat_data.phase')\n");
    await writeSource(project.slug, "ejs/stage.ejs", "const lore = getwi('阶段一'); if (stat_data.phase === 'start') { }\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" },
      html: { statusbar: { enabled: false } },
      regex: {},
      ejs: { enabled: true, preprocess: { file: "../source/ejs/preprocess.ejs" }, entries: [{ id: "stage", file: "../source/ejs/stage.ejs", role: "stage", enabled: true, conditionVariables: [] }] },
    });

    const report = await validateProject(project);
    expect(report.issues.some((issue) => issue.code === "ejs.stage.enabled")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "ejs.getwi_without_await")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "ejs.let_const")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "ejs.condition_variable_missing")).toBe(true);

    const card = await buildCharacterCardJson(project, (await readDraft(project)).card!, (await readDraft(project)).worldbook, (await readDraft(project)).assets, new Date().toISOString()) as any;
    expect(card.data.character_book.entries.some((entry: any) => entry.comment === "[EJS]预处理")).toBe(true);
  });

  it("statically compares mvu schema and initvar values", async () => {
    const { project } = await createTestProject("v5-mvp-validate-mvu-schema-compare", "character_card");
    await writeSource(project.slug, "mvu/schema.js", "export const Schema = z.object({ hp: z.number(), name: z.string(), alive: z.boolean().default(true), nested: z.object({ level: z.number() }) });\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "hp: wrong\nnested:\n  level: 3\nextra: true\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "hp: 变化\n");
    await writeSource(project.slug, "mvu/variable-list.md", "hp\nnested.level\n");
    await writeSource(project.slug, "mvu/output-format.md", "hp nested.level\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" },
      html: { statusbar: { enabled: false } },
      regex: {},
      ejs: { enabled: false, entries: [] },
    });

    const report = await validateMvuProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "mvu.initvar.schema_type_mismatch" && issue.message.includes("hp"))).toBe(true);
    expect(report.issues.some((issue) => issue.code === "mvu.initvar.schema_required_missing" && issue.message.includes("name"))).toBe(true);
    expect(report.issues.some((issue) => issue.code === "mvu.initvar.schema_extra_variable" && issue.message.includes("extra"))).toBe(true);
  });

  it("validates mvu schema export and initvar yaml", async () => {
    const { project } = await createTestProject("v5-mvp-validate-mvu", "character_card");
    await writeSource(project.slug, "mvu/schema.js", "const Schema = {};\n");
    await writeSource(project.slug, "mvu/initvar.yaml", "stat_data:\n  hp: 10\n");
    await writeSource(project.slug, "mvu/update-rules.yaml", "hp: 变化\n");
    await writeSource(project.slug, "mvu/variable-list.md", "{{stat_data.hp}}\n");
    await writeSource(project.slug, "mvu/output-format.md", "hp\n");
    await writeDraft(project, "assets", {
      mvu: { enabled: true, schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" },
      html: { statusbar: { enabled: false } },
      regex: {},
      ejs: { enabled: false, entries: [] },
    });

    const report = await validateMvuProject(project);
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "mvu.schema.missing_export")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "mvu.initvar.stat_data_root" && issue.severity === "warning")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "mvu.variable_list.raw_macro" && issue.severity === "warning")).toBe(true);
  });
});
