import { describe, expect, it } from "vitest";
import { buildMvuAssets, MVU_OUTPUT_FORMAT_TAG, MVU_UPDATE_RULES_TAG } from "../src/core/mvu-assets.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";
import { MvuConfigSchema } from "../src/schemas/mvu.js";

describe("buildMvuAssets", () => {
  it("builds worldbook, regex and tavern helper assets", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets(mvu);
    expect(assets.worldbookEntries.some((entry) => entry.comment.includes("initvar"))).toBe(true);
    expect(assets.worldbookEntries.some((entry) => entry.position === "at_depth" && entry.depth === 0)).toBe(true);
    expect(assets.regexScripts.some((script) => script.scriptName.includes("去除变量更新"))).toBe(true);
    expect(assets.tavernHelperScripts.some((script) => script.name === "变量结构")).toBe(true);
  });

  it("never emits a YAML doc separator `---` in any worldbook entry content", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A", "角色B"] });
    const assets = buildMvuAssets(mvu);
    for (const entry of assets.worldbookEntries) {
      expect(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(entry.content)).toBe(false);
    }
  });

  it("wraps update rules and output format with semantic XML tags", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets(mvu);

    const updateRulesEntry = assets.worldbookEntries.find((entry) => entry.comment.includes("变量更新规则"));
    expect(updateRulesEntry).toBeDefined();
    expect(updateRulesEntry!.content.startsWith(`<${MVU_UPDATE_RULES_TAG}>`)).toBe(true);
    expect(updateRulesEntry!.content.endsWith(`</${MVU_UPDATE_RULES_TAG}>`)).toBe(true);

    const outputFormatEntry = assets.worldbookEntries.find((entry) => entry.comment.includes("变量输出格式"));
    expect(outputFormatEntry).toBeDefined();
    expect(outputFormatEntry!.content.startsWith(`<${MVU_OUTPUT_FORMAT_TAG}>`)).toBe(true);
    expect(outputFormatEntry!.content.endsWith(`</${MVU_OUTPUT_FORMAT_TAG}>`)).toBe(true);
  });

  it("strips `---` inside already wrapped MVU fields before emitting worldbook entries", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets({
      ...mvu,
      update_rules: `<${MVU_UPDATE_RULES_TAG}>\n---\n变量更新规则:\n  foo:\n    check:\n      - bar\n</${MVU_UPDATE_RULES_TAG}>`,
      output_format: `<${MVU_OUTPUT_FORMAT_TAG}>\n---\n变量输出格式:\n  rule:\n    - bar\n</${MVU_OUTPUT_FORMAT_TAG}>`,
    });

    const updateRulesEntry = assets.worldbookEntries.find((entry) => entry.comment.includes("变量更新规则"));
    const outputFormatEntry = assets.worldbookEntries.find((entry) => entry.comment.includes("变量输出格式"));
    expect(updateRulesEntry!.content).not.toMatch(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/);
    expect(outputFormatEntry!.content).not.toMatch(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/);
    expect((updateRulesEntry!.content.match(new RegExp(`<${MVU_UPDATE_RULES_TAG}>`, "g")) ?? []).length).toBe(1);
    expect((outputFormatEntry!.content.match(new RegExp(`<${MVU_OUTPUT_FORMAT_TAG}>`, "g")) ?? []).length).toBe(1);
  });

  it("variable list entry is wrapped in <status_current_variable> only, no leading `---`", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets(mvu);
    const variableListEntry = assets.worldbookEntries.find((entry) => entry.comment === "变量列表");
    expect(variableListEntry).toBeDefined();
    expect(variableListEntry!.content.startsWith("<status_current_variable>")).toBe(true);
    expect(variableListEntry!.content).not.toMatch(/^---/);
  });

  it("strips `---` and double-wrapping from AI-supplied update_rules / output_format via schema transform", () => {
    const parsed = MvuConfigSchema.parse({
      enabled: true,
      style: "zod",
      schema_script: "export const Schema = z.object({}); registerMvuSchema(Schema);",
      initvar: "---\n<initvar>\n角色:\n  好感度: 20\n</initvar>\n---",
      update_rules: "---\n<variable_update_rules>\n变量更新规则:\n  角色:\n    好感度:\n      check:\n        - foo\n</variable_update_rules>",
      output_format: "---\n变量输出格式:\n  rule:\n    - bar",
    });

    expect(parsed.initvar).toBe("角色:\n  好感度: 20");
    expect(parsed.update_rules.startsWith("---")).toBe(false);
    expect(parsed.update_rules.includes("<variable_update_rules>")).toBe(false);
    expect(parsed.update_rules).toContain("变量更新规则:");
    expect(parsed.output_format!.startsWith("---")).toBe(false);
    expect(parsed.output_format).toContain("变量输出格式:");

    const assets = buildMvuAssets(parsed);
    for (const entry of assets.worldbookEntries) {
      expect(/(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(entry.content)).toBe(false);
    }
    // builder 仍然能正确合成包含 <variable_update_rules> 标签的条目，且没有重复嵌套
    const updateRulesEntry = assets.worldbookEntries.find((entry) => entry.comment.includes("变量更新规则"));
    expect((updateRulesEntry!.content.match(/<variable_update_rules>/g) ?? []).length).toBe(1);
  });
});
