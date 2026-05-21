import { describe, expect, it } from "vitest";
import { createFinalReviewReport } from "../src/core/final-review.js";
import type { Project } from "../src/schemas/project.js";

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_test",
    name: "测试",
    sources: [],
    research: [],
    patches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createFinalReviewReport", () => {
  it("attaches pending_decisions section with warnings when project has pending decisions", () => {
    const project = baseProject({
      pendingDecisions: [{
        id: "card_type",
        question: "卡型？",
        options: [],
        allow_custom: true,
        multiple: false,
        created_at: "2026-01-01T00:00:00.000Z",
        source_tool: "classify_worldbook_card_type",
      }],
    });
    const report = createFinalReviewReport(project);
    expect(report.sections.pending_decisions?.warnings.length).toBe(1);
    expect(report.recommendations.some((line) => line.includes("未解决"))).toBe(true);
  });

  it("returns ok pending_decisions section when no pending decision", () => {
    const report = createFinalReviewReport(baseProject());
    expect(report.sections.pending_decisions?.ok).toBe(true);
    expect(report.sections.pending_decisions?.warnings).toHaveLength(0);
  });
});
