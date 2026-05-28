import { describe, expect, it } from "vitest";
import { validateMvuConfig } from "../src/core/mvu-validator.js";
import { mvuContentFromEntries, normalizeMvuEntryContent } from "../src/core/mvu-entry-templates.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

function baseTemplate() {
  const template = createMvuTemplate({ characterNames: ["角色A"] });
  return { mvu: template.mvu, mvuContent: mvuContentFromEntries(template.entries) };
}

describe("validateMvuConfig", () => {
  it("accepts generated template", () => {
    const input = baseTemplate();
    const result = validateMvuConfig(input);
    expect(result.valid).toBe(true);
  });

  it("rejects missing registerMvuSchema", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "export const Schema = z.object({});" }, mvuContent });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "schemaScript")).toBe(true);
  });

  it("normalizes wrapped initvar entry content before validation", () => {
    const { mvu } = baseTemplate();
    const mvuContent = { ...baseTemplate().mvuContent, initvar: normalizeMvuEntryContent("initvar", "<initvar>\n角色A: {}\n</initvar>") };
    const result = validateMvuConfig({ mvu, mvuContent });
    expect(result.warnings.some((issue) => issue.code === "mvu.initvar.empty")).toBe(false);
  });

  it("rejects unsupported zod methods", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "export const Schema = z.object({ a: z.string().optional() }); registerMvuSchema(Schema);" }, mvuContent });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("optional"))).toBe(true);
  });

  it("requires fixed schema wrapper", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "const Bad = z.object({}); registerMvuSchema(Bad);" }, mvuContent });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("export const Schema"))).toBe(true);
    expect(result.errors.some((issue) => issue.message.includes("registerMvuSchema(Schema)"))).toBe(true);
  });

  it("does not falsely flag beta keywords appearing in comments or string literals", () => {
    const { mvu, mvuContent } = baseTemplate();
    const safeScript = `${mvu.schemaScript}\n// 不要使用 _.add( 或 getvar( 这种 Beta 风格\nconst note = "_.set(...)";`;
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: safeScript }, mvuContent });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("beta"))).toBe(false);
  });

  it("does not falsely flag updateRules when an unrelated 3-letter sequence ends with set/add", () => {
    const { mvu, mvuContent } = baseTemplate();
    const updateRules = `${mvuContent.updateRules}\n# 资产说明 asset(已加载)`;
    const result = validateMvuConfig({ mvu, mvuContent: { ...mvuContent, updateRules } });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(false);
  });

  it("still detects beta-style update rules outside of strings", () => {
    const { mvu, mvuContent } = baseTemplate();
    const updateRules = `${mvuContent.updateRules}\n_.set(stat_data[0].hp, 100)`;
    const result = validateMvuConfig({ mvu, mvuContent: { ...mvuContent, updateRules } });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(true);
  });

  it("validates updateRules and outputFormat after XML wrappers are stripped", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({
      mvu,
      mvuContent: {
        ...mvuContent,
        updateRules: normalizeMvuEntryContent("updateRules", "<variable_update_rules>\n变量更新规则:\n  角色A:\n    好感度:\n      check:\n        - foo\n</variable_update_rules>"),
        outputFormat: normalizeMvuEntryContent("outputFormat", "<variable_output_format>\n变量输出格式:\n  rule: foo\n</variable_output_format>"),
      },
    });
    expect(result.warnings.some((issue) => issue.message.includes("variable_update_rules"))).toBe(false);
    expect(result.warnings.some((issue) => issue.message.includes("variable_output_format"))).toBe(false);
  });

  it("rejects initvar with duplicated variableListPath root", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({
      mvu: { ...mvu, schemaScript: "export const Schema = z.object({ target: z.object({ name: z.string().prefault('') }) });\nregisterMvuSchema(Schema);" },
      mvuContent: { ...mvuContent, initvar: "stat_data:\n  target:\n    name: foo" },
    });
    expect(result.errors.some((issue) => issue.code === "mvu.initvar.root_mismatch")).toBe(true);
  });

  it("rejects js assignment style update rules", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({ mvu, mvuContent: { ...mvuContent, updateRules: "target.affection = _.clamp(target.affection, 0, 100);" } });
    expect(result.errors.some((issue) => issue.code === "mvu.update_rules.js_assignment")).toBe(true);
  });

  it("warns when required MVU system entry content is missing", () => {
    const { mvu, mvuContent } = baseTemplate();
    const result = validateMvuConfig({ mvu, mvuContent: { ...mvuContent, initvar: "", updateRules: "" } });
    expect(result.warnings.some((issue) => issue.code === "mvu.initvar.empty")).toBe(true);
    expect(result.warnings.some((issue) => issue.code === "mvu.update_rules.empty")).toBe(true);
  });
});
