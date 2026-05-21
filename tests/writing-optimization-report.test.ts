import { describe, expect, it } from "vitest";
import { createWritingOptimizationReport } from "../src/core/writing-optimization-report.js";

describe("createWritingOptimizationReport", () => {
  it("groups lint issues by category", () => {
    const report = createWritingOptimizationReport({ content: "一丝笑意像湖面涟漪。" });
    expect(report.ok).toBe(false);
    expect(report.summary.by_category.quantum_word).toBeGreaterThan(0);
    expect(report.summary.by_category.metaphor).toBeGreaterThan(0);
  });
});
