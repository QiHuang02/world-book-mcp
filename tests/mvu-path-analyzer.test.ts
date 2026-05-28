import { describe, expect, it } from "vitest";
import { analyzeMvuPaths, fromUiPath, normalizePath, toUiPath } from "../src/core/mvu-path-analyzer.js";

const baseConfig = {
  schemaScript: "",
  initvar: "",
  updateRules: "",
};

describe("mvu-path-analyzer path helpers", () => {
  it("toUiPath prefixes stat_data when missing", () => {
    expect(toUiPath("hp")).toBe("stat_data.hp");
    expect(toUiPath("stat_data.hp")).toBe("stat_data.hp");
    expect(toUiPath("stat_data")).toBe("stat_data");
  });

  it("fromUiPath strips stat_data prefix", () => {
    expect(fromUiPath("stat_data.hp.max")).toBe("hp.max");
    expect(fromUiPath("hp.max")).toBe("hp.max");
  });

  it("normalizePath collapses slashes and stat_data segments", () => {
    expect(normalizePath("/stat_data/hp/max")).toBe("hp.max");
    expect(normalizePath("stat_data.hp.max")).toBe("hp.max");
    expect(normalizePath("hp..max")).toBe("hp.max");
  });
});

describe("analyzeMvuPaths schema parsing", () => {
  it("parses nested z.object and respects readonly/hidden prefixes", () => {
    const script = `
      export const Schema = z.object({
        hp: z.coerce.number().prefault(100),
        stats: z.object({
          attack: z.coerce.number().prefault(10),
          _internal: z.coerce.number().prefault(0),
          $hidden: z.string().prefault(""),
        }),
      });
      registerMvuSchema(Schema);
    `;
    const result = analyzeMvuPaths({ ...baseConfig, schemaScript: script });
    const paths = result.schemaPaths.map((item) => item.path).sort();
    expect(paths).toEqual(["hp", "stats.$hidden", "stats._internal", "stats.attack"]);
    expect(result.readonlyPaths).toContain("stats._internal");
    expect(result.hiddenPaths).toContain("stats.$hidden");
  });

  it("treats prefault default values without splitting on inner commas", () => {
    const script = `
      export const Schema = z.object({
        config: z.object({}).prefault({ name: "x, y", count: 3 }),
        hp: z.coerce.number().prefault(100),
      });
      registerMvuSchema(Schema);
    `;
    const result = analyzeMvuPaths({ ...baseConfig, schemaScript: script });
    const paths = result.schemaPaths.map((item) => item.path).sort();
    expect(paths).toEqual(["config", "hp"]);
    const configVar = result.schemaPaths.find((item) => item.path === "config");
    expect(configVar?.defaultValue).toEqual({ name: "x, y", count: 3 });
  });

  it("parses initvar as YAML leaf paths", () => {
    const initvar = `
hp: 100
stats:
  attack: 10
  defense: 5
`;
    const result = analyzeMvuPaths({ ...baseConfig, initvar });
    expect(result.initvarPaths).toContain("hp");
    expect(result.initvarPaths).toContain("stats.attack");
    expect(result.initvarPaths).toContain("stats.defense");
  });

  it("parses updateRules with type/range/check suffixes stripped", () => {
    const updateRules = `
变量更新规则:
  hp:
    type: number
    check: clamp
  stats.attack:
    type: number
`;
    const result = analyzeMvuPaths({ ...baseConfig, updateRules });
    expect(result.updateRulePaths).toContain("hp");
    expect(result.updateRulePaths).toContain("stats.attack");
  });

  it("emits warning when schema script lacks export const Schema = z.object", () => {
    const script = `
      const X = z.object({ hp: z.number() });
    `;
    const result = analyzeMvuPaths({ ...baseConfig, schemaScript: script });
    expect(result.schemaPaths).toHaveLength(0);
    expect(result.parseWarnings.some((issue) => issue.code === "mvu.schema.missing_schema_object")).toBe(true);
  });
});
