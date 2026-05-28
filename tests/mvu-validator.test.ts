import { describe, expect, it } from "vitest";
import { validateMvuConfig } from "../src/core/mvu-validator.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("validateMvuConfig", () => {
  it("accepts generated template", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu });
    expect(result.valid).toBe(true);
  });

  it("rejects missing registerMvuSchema", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "export const Schema = z.object({});" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "schemaScript")).toBe(true);
  });

  it("warns about wrapped initvar", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, initvar: "<initvar>\n角色A: {}\n</initvar>" } });
    expect(result.warnings.some((issue) => issue.field === "initvar")).toBe(true);
  });

  it("rejects unsupported zod methods", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "export const Schema = z.object({ a: z.string().optional() }); registerMvuSchema(Schema);" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("optional"))).toBe(true);
  });

  it("requires fixed schema wrapper", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: "const Bad = z.object({}); registerMvuSchema(Bad);" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("export const Schema"))).toBe(true);
    expect(result.errors.some((issue) => issue.message.includes("registerMvuSchema(Schema)"))).toBe(true);
  });

  it("does not falsely flag beta keywords appearing in comments or string literals", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    // 注释和 .describe(...) 字符串里提到 _.add( / getvar( 不应触发 beta 风格报错。
    const safeScript = `${mvu.schemaScript}\n// 不要使用 _.add( 或 getvar( 这种 Beta 风格\nconst note = "_.set(...)";`;
    const result = validateMvuConfig({ mvu: { ...mvu, schemaScript: safeScript } });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("beta"))).toBe(false);
  });

  it("does not falsely flag updateRules when an unrelated 3-letter sequence ends with set/add", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    // 'asset(' 不应被未转义的点号误命中。
    const updateRules = `${mvu.updateRules}\n# 资产说明 asset(已加载)`;
    const result = validateMvuConfig({ mvu: { ...mvu, updateRules: updateRules } });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(false);
  });

  it("still detects beta-style update rules outside of strings", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const updateRules = `${mvu.updateRules}\n_.set(stat_data[0].hp, 100)`;
    const result = validateMvuConfig({ mvu: { ...mvu, updateRules: updateRules } });
    expect(result.errors.some((issue) => issue.message.includes("Beta"))).toBe(true);
  });

  it("warns when updateRules carries XML wrapper", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({
      mvu: { ...mvu, updateRules: "<variable_update_rules>\n变量更新规则:\n  角色A:\n    好感度:\n      check:\n        - foo\n</variable_update_rules>" },
    });
    expect(result.warnings.some((issue) => issue.field === "updateRules" && issue.message.includes("variable_update_rules"))).toBe(true);
  });

  it("warns when outputFormat carries XML wrapper", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({
      mvu: { ...mvu, outputFormat: "<variable_output_format>\n变量输出格式:\n  rule: foo\n</variable_output_format>" },
    });
    expect(result.warnings.some((issue) => issue.field === "outputFormat" && issue.message.includes("variable_output_format"))).toBe(true);
  });
});
