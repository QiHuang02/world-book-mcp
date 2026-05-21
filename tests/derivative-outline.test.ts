import { describe, expect, it } from "vitest";
import { createDerivativeExtractionTemplate, derivativeOutlineToExtraction, validateDerivativeExtractionOutline } from "../src/core/derivative-outline.js";

describe("derivative outline", () => {
  it("creates a full character/world extraction template", () => {
    const outline = createDerivativeExtractionTemplate({ title: "测试", focus: ["characters", "world"] });
    expect(outline.characters[0].dimensions).toHaveLength(8);
    expect(outline.world_dimensions).toHaveLength(5);
  });

  it("validates chapter line ranges", () => {
    const outline = createDerivativeExtractionTemplate();
    outline.chapter_index[0].endLine = 0;
    const result = validateDerivativeExtractionOutline(outline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field?.includes("chapter_index"))).toBe(true);
  });

  it("converts outline to extraction result", () => {
    const outline = createDerivativeExtractionTemplate({ title: "测试" });
    outline.characters[0].dimensions[1].extracted_result = "异色瞳";
    const extraction = derivativeOutlineToExtraction("project_x", outline);
    expect(extraction.characters[0].appearance).toContain("异色瞳");
  });
});
