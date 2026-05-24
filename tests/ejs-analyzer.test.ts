import { describe, expect, it } from "vitest";
import { analyzeEjsConfig, normalizeEjsUiPath } from "../src/core/ejs-analyzer.js";
import type { EjsConfig } from "../src/schemas/ejs.js";

function makeConfig(overrides: Partial<EjsConfig> = {}): EjsConfig {
  return {
    enabled: true,
    template_type: "custom",
    variable_paths: [],
    entries: [],
    ...overrides,
  };
}

describe("normalizeEjsUiPath", () => {
  it("keeps stat_data prefix as-is", () => {
    expect(normalizeEjsUiPath("stat_data")).toBe("stat_data");
    expect(normalizeEjsUiPath("stat_data.hp")).toBe("stat_data.hp");
  });

  it("prefixes bare paths with stat_data", () => {
    expect(normalizeEjsUiPath("hp.max")).toBe("stat_data.hp.max");
  });
});

describe("analyzeEjsConfig", () => {
  it("extracts getvar paths from inline content", () => {
    const config = makeConfig({
      variable_paths: ["stat_data.hp"],
      entries: [{
        name: "controller",
        role: "controller",
        content: "<% var hp = getvar('stat_data.hp'); %>",
        keys: [],
        constant: true,
        position: "after_char",
        order: 100,
        enabled: true,
      }],
    });
    const result = analyzeEjsConfig(config);
    expect(result.content_variable_paths).toContain("stat_data.hp");
    expect(result.declared_variable_paths).toContain("stat_data.hp");
  });

  it("extracts _.get(stat_data, 'path') style accesses", () => {
    const config = makeConfig({
      variable_paths: ["stat_data.stats.attack"],
      entries: [{
        name: "controller",
        role: "controller",
        content: "<% var atk = _.get(stat_data, 'stats.attack'); %>",
        keys: [],
        constant: true,
        position: "after_char",
        order: 100,
        enabled: true,
      }],
    });
    const result = analyzeEjsConfig(config);
    expect(result.content_variable_paths).toContain("stat_data.stats.attack");
  });

  it("extracts _.get(getvar('stat_data'), 'path') wrapped form", () => {
    const config = makeConfig({
      variable_paths: ["stat_data.stats.defense"],
      entries: [{
        name: "controller",
        role: "controller",
        content: "<% var d = _.get(getvar('stat_data'), 'stats.defense'); %>",
        keys: [],
        constant: true,
        position: "after_char",
        order: 100,
        enabled: true,
      }],
    });
    const result = analyzeEjsConfig(config);
    expect(result.content_variable_paths).toContain("stat_data.stats.defense");
  });

  it("collects getwi references with their owning entry name", () => {
    const config = makeConfig({
      entries: [{
        name: "controller",
        role: "controller",
        content: "<% var stage = await getwi('stage_morning'); %>",
        keys: [],
        constant: true,
        position: "after_char",
        order: 100,
        enabled: true,
      }],
    });
    const result = analyzeEjsConfig(config);
    expect(result.getwi_refs).toEqual([{ entry_name: "controller", ref: "stage_morning" }]);
  });

  it("normalizes content paths with array indices", () => {
    const config = makeConfig({
      variable_paths: ["stat_data.list.0"],
      entries: [{
        name: "controller",
        role: "controller",
        content: "<% var first = _.get(stat_data, 'list[0]'); %>",
        keys: [],
        constant: true,
        position: "after_char",
        order: 100,
        enabled: true,
      }],
    });
    const result = analyzeEjsConfig(config);
    expect(result.content_variable_paths).toContain("stat_data.list.0");
  });
});
