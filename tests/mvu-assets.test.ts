import { describe, expect, it } from "vitest";
import { buildMvuAssets, MVU_OUTPUT_FORMAT_TAG, MVU_UPDATE_RULES_TAG, MVU_VARIABLE_LIST_TAG } from "../src/core/mvu-assets.js";
import { createMvuSystemEntries, mvuContentFromEntries, normalizeMvuEntryContent } from "../src/core/mvu-entry-templates.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import { MvuConfigSchema } from "../src/schemas/mvu.js";

describe("buildMvuAssets", () => {
  it("builds regex and tavern helper assets without synthesizing worldbook entries", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets(mvu);
    expect("worldbookEntries" in assets).toBe(false);
    expect(assets.regexScripts.some((script) => script.scriptName.includes("去除变量更新"))).toBe(true);
    expect(assets.tavernHelperScripts.some((script) => script.name === "变量结构")).toBe(true);
  });
});

describe("MVU system entries", () => {
  it("template creates four real worldbook entries with distinct default metadata", () => {
    const { entries } = createMvuTemplate({ characterNames: ["角色A"] });
    const byComment = new Map(entries.map((entry) => [entry.comment, entry]));
    expect(byComment.get("[initvar]变量初始化")).toMatchObject({ order: 14720, position: "at_depth", depth: 0, enabled: true });
    expect(byComment.get("变量列表")).toMatchObject({ order: 14721, position: "at_depth", depth: 0, enabled: true });
    expect(byComment.get("[mvu_update]变量更新规则")).toMatchObject({ order: 14722, position: "at_depth", depth: 0, enabled: true });
    expect(byComment.get("[mvu_update]变量输出格式")).toMatchObject({ order: 14723, position: "at_depth", depth: 0, enabled: true });
    expect(entries.map((entry) => entry.order)).toEqual([14720, 14721, 14722, 14723]);
  });

  it("never emits a YAML doc separator `---` in system entry content", () => {
    const { entries } = createMvuTemplate({ characterNames: ["角色A", "角色B"] });
    for (const entry of entries) {
      expect(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(entry.content)).toBe(false);
    }
  });

  it("wraps update rules and output format with semantic XML tags", () => {
    const { entries } = createMvuTemplate({ characterNames: ["角色A"] });

    const updateRulesEntry = entries.find((entry) => entry.comment.includes("变量更新规则"));
    expect(updateRulesEntry).toBeDefined();
    expect(updateRulesEntry!.content.startsWith(`<${MVU_UPDATE_RULES_TAG}>`)).toBe(true);
    expect(updateRulesEntry!.content.endsWith(`</${MVU_UPDATE_RULES_TAG}>`)).toBe(true);

    const outputFormatEntry = entries.find((entry) => entry.comment.includes("变量输出格式"));
    expect(outputFormatEntry).toBeDefined();
    expect(outputFormatEntry!.content.startsWith(`<${MVU_OUTPUT_FORMAT_TAG}>`)).toBe(true);
    expect(outputFormatEntry!.content.endsWith(`</${MVU_OUTPUT_FORMAT_TAG}>`)).toBe(true);
  });

  it("strips `---` and double wrapping when normalizing MVU entry content", () => {
    const updateRulesContent = normalizeMvuEntryContent("updateRules", `<${MVU_UPDATE_RULES_TAG}>\n---\n变量更新规则:\n  foo:\n    check:\n      - bar\n</${MVU_UPDATE_RULES_TAG}>`);
    const outputFormatContent = normalizeMvuEntryContent("outputFormat", `<${MVU_OUTPUT_FORMAT_TAG}>\n---\n变量输出格式:\n  rule:\n    - bar\n</${MVU_OUTPUT_FORMAT_TAG}>`);

    expect(updateRulesContent).not.toMatch(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/);
    expect(outputFormatContent).not.toMatch(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/);
    expect((updateRulesContent.match(new RegExp(`<${MVU_UPDATE_RULES_TAG}>`, "g")) ?? []).length).toBe(1);
    expect((outputFormatContent.match(new RegExp(`<${MVU_OUTPUT_FORMAT_TAG}>`, "g")) ?? []).length).toBe(1);
  });

  it("variable list entry is wrapped in <status_current_variable> only, no leading `---`", () => {
    const { entries } = createMvuTemplate({ characterNames: ["角色A"] });
    const variableListEntry = entries.find((entry) => entry.comment === "变量列表");
    expect(variableListEntry).toBeDefined();
    expect(variableListEntry!.content.startsWith(`<${MVU_VARIABLE_LIST_TAG}>`)).toBe(true);
    expect(variableListEntry!.content).not.toMatch(/^---/);
  });

  it("keeps runtime config free of legacy MVU content fields", () => {
    const parsed = MvuConfigSchema.parse({
      schemaScript: "export const Schema = z.object({}); registerMvuSchema(Schema);",
      initvar: "---\n<initvar>\n角色:\n  好感度: 20\n</initvar>\n---",
      updateRules: "---\n<variable_update_rules>\n变量更新规则:\n  角色:\n    好感度:\n      check:\n        - foo\n</variable_update_rules>",
      outputFormat: "---\n变量输出格式:\n  rule:\n    - bar",
      variableListPath: "stat_data",
      hideRegex: true,
      beautifyRegex: false,
    });

    expect(parsed).not.toHaveProperty("initvar");
    expect(parsed).not.toHaveProperty("updateRules");
    expect(parsed).not.toHaveProperty("outputFormat");

    const entries = createMvuSystemEntries({ runtime: parsed, initvar: "角色:\n  好感度: 20", updateRules: "变量更新规则:\n  角色:\n    好感度:\n      check:\n        - foo" });
    const content = mvuContentFromEntries(entries);
    expect(content.initvar).toBe("角色:\n  好感度: 20");
    expect(content.updateRules).toContain("变量更新规则:");
  });
});
