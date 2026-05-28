import { describe, expect, it } from "vitest";
import { listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../src/core/mvu-variable-editor.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

const baseMvu = () => createMvuTemplate({ characterNames: ["角色A"] }).mvu;

describe("mvu variable editor", () => {
  it("lists variables from generated template", () => {
    const result = listMvuVariables(baseMvu());
    expect(result.warnings).toEqual([]);
    expect(result.variables.map((variable) => variable.path.join("."))).toContain("角色A.好感度");
    expect(result.variables.map((variable) => variable.path.join("."))).toContain("角色A.心情");
  });

  it("upserts a variable and rewrites mvu fields", () => {
    const result = upsertMvuVariable(baseMvu(), {
      path: ["角色A", "信任度"],
      kind: "number",
      defaultValue: 10,
      min: 0,
      max: 100,
      updateRule: "根据守约、照顾和坦诚交流调整",
    });

    expect(result.created).toBe(true);
    expect(result.mvu.schemaScript).toContain('"信任度": z.coerce.number()');
    expect(result.mvu.initvar).toContain("信任度: 10");
    expect(result.mvu.updateRules).toContain("根据守约、照顾和坦诚交流调整");
    expect(result.mvu.schemaScript).toContain("registerMvuSchema(Schema)");
    // updateRules 是纯 YAML，由 builder 在合成世界书条目时再统一加 XML 包裹，这里不应自带 `---` 分隔符
    expect(result.mvu.updateRules.startsWith("---")).toBe(false);
    expect(result.mvu.updateRules.split(/\r?\n/)[0]).toBe("变量更新规则:");
  });

  it("overwrites an existing variable", () => {
    const result = upsertMvuVariable(baseMvu(), {
      path: ["角色A", "好感度"],
      kind: "number",
      defaultValue: 30,
      min: -100,
      max: 100,
    });

    expect(result.created).toBe(false);
    expect(result.mvu.schemaScript).toContain("_.clamp(v, -100, 100)");
    expect(result.mvu.initvar).toContain("好感度: 30");
  });

  it("removes a variable from schema, initvar and rules", () => {
    const result = removeMvuVariable(baseMvu(), ["角色A", "心情"]);

    expect(result.removed).toBe(true);
    expect(result.mvu.schemaScript).not.toContain("心情");
    expect(result.mvu.initvar).not.toContain("心情");
    expect(result.mvu.updateRules).not.toContain("心情");
  });

  it("rewrites variables from a complete list", () => {
    const result = rewriteMvuVariables(baseMvu(), [
      { path: ["世界", "当前地点"], kind: "string", defaultValue: "教室" },
      { path: ["角色A", "_生日"], kind: "string", defaultValue: "4月8日" },
      { path: ["系统", "$路线"], kind: "enum", enumValues: ["日常", "事件"], defaultValue: "日常" },
    ]);

    expect(result.mvu.schemaScript).toContain("当前地点");
    expect(result.mvu.schemaScript).toContain('"$路线"');
    expect(result.mvu.updateRules).not.toContain("_生日");
  });

  it("rejects unsafe schema expressions", () => {
    expect(() => upsertMvuVariable(baseMvu(), {
      path: ["角色A", "坏变量"],
      kind: "custom",
      schemaExpression: "z.string().optional()",
    })).toThrow(/禁止片段/);
  });
});
