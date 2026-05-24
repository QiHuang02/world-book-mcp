import { describe, expect, it } from "vitest";
import { analyzeMvuPaths, fromUiPath, normalizePath, toUiPath } from "../src/core/mvu-path-analyzer.js";

const baseConfig = {
  schema_script: "",
  initvar: "",
  update_rules: "",
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
    const result = analyzeMvuPaths({ ...baseConfig, schema_script: script });
    const paths = result.schema_paths.map((item) => item.path).sort();
    expect(paths).toEqual(["hp", "stats.$hidden", "stats._internal", "stats.attack"]);
    expect(result.readonly_paths).toContain("stats._internal");
    expect(result.hidden_paths).toContain("stats.$hidden");
  });

  it("treats prefault default values without splitting on inner commas", () => {
    const script = `
      export const Schema = z.object({
        config: z.object({}).prefault({ name: "x, y", count: 3 }),
        hp: z.coerce.number().prefault(100),
      });
      registerMvuSchema(Schema);
    `;
    const result = analyzeMvuPaths({ ...baseConfig, schema_script: script });
    const paths = result.schema_paths.map((item) => item.path).sort();
    expect(paths).toEqual(["config", "hp"]);
    const configVar = result.schema_paths.find((item) => item.path === "config");
    expect(configVar?.has_default).toBe(true);
  });

  it("parses initvar as YAML leaf paths", () => {
    const initvar = `
hp: 100
stats:
  attack: 10
  defense: 5
`;
    const result = analyzeMvuPaths({ ...baseConfig, initvar });
    expect(result.initvar_paths).toContain("hp");
    expect(result.initvar_paths).toContain("stats.attack");
    expect(result.initvar_paths).toContain("stats.defense");
  });

  it("parses update_rules with type/range/check suffixes stripped", () => {
    const update_rules = `
变量更新规则:
  hp:
    type: number
    check: clamp
  stats.attack:
    type: number
`;
    const result = analyzeMvuPaths({ ...baseConfig, update_rules });
    expect(result.update_rule_paths).toContain("hp");
    expect(result.update_rule_paths).toContain("stats.attack");
  });

  it("emits warning when schema script lacks export const Schema = z.object", () => {
    const script = `
      const X = z.object({ hp: z.number() });
    `;
    const result = analyzeMvuPaths({ ...baseConfig, schema_script: script });
    expect(result.schema_paths).toHaveLength(0);
    expect(result.parse_warnings.some((issue) => issue.code === "mvu.schema.missing_schema_object")).toBe(true);
  });
});
