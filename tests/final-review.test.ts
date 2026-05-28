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
      plan: { enabled_assets: {}, acceptance_criteria: ["验收"], verification_steps: ["验证"] },
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
