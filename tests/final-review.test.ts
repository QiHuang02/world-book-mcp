import { describe, expect, it } from "vitest";
import { createFinalReviewReport } from "../src/core/final-review.js";
import type { Project } from "../src/schemas/project.js";

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_test",
    name: "测试",
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    plan: { enabled_assets: {} },
    imports: [],
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
        source_tool: "skill.task-routing",
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

  it("does not duplicate pending decisions inside plan section", () => {
    const project = baseProject({
      pendingDecisions: [{
        id: "card_type",
        question: "卡型？",
        options: [],
        allow_custom: true,
        multiple: false,
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    });
    const report = createFinalReviewReport(project);
    // pending decisions 现在只来自 pending_decisions section，不再混进 plan
    expect(report.sections.plan?.errors).toHaveLength(0);
    expect(report.sections.plan?.warnings).toHaveLength(0);
  });
});
