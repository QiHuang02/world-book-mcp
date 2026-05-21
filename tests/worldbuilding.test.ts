import { describe, expect, it } from "vitest";
import { classifyWorldbuildingType, createWorldbuildingDesignTemplate, createWorldbuildingOutline, validateWorldbuildingDesign, validateWorldbuildingSummary } from "../src/core/worldbuilding.js";

describe("worldbuilding", () => {
  it("creates an outline template", () => {
    const outline = createWorldbuildingOutline({ title: "小镇" });
    expect(outline.template.title).toBe("小镇");
    expect(outline.rules.length).toBeGreaterThan(0);
  });

  it("validates required fields", () => {
    const result = validateWorldbuildingSummary({ world_type: "B_small_world", title: "", summary: "" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.field === "title")).toBe(true);
  });

  it("classifies large worlds with high confidence", () => {
    const result = classifyWorldbuildingType({ title: "九州大陆", brief: "魔法与修仙并存的架空世界" });
    expect(result.world_type).toBe("C_large_world");
    expect(result.confidence).toBe("high");
  });

  it("returns design template sections by world type", () => {
    const template = createWorldbuildingDesignTemplate({ world_type: "C_large_world", title: "测试" });
    const names = template.sections.map((section) => section.name);
    expect(names).toContain("technology");
    expect(template.sections.find((section) => section.name === "geography")?.required).toBe(true);
  });

  it("flags missing required dimensions for large worlds", () => {
    const result = validateWorldbuildingDesign({ world_type: "C_large_world", title: "测试", geography: "" });
    expect(result.ok).toBe(false);
    expect(result.summary.missing_required).toContain("geography");
    expect(result.summary.missing_required).toContain("history");
  });
});
