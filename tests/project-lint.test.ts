import { describe, expect, it } from "vitest";
import { validateProject } from "../src/core/project-validator.js";
import type { Project } from "../src/schemas/project.js";

function baseProject(): Project {
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
  };
}

describe("content lint delegation", () => {
  it("keeps legacy test file as delegated compatibility coverage", () => {
    const report = validateProject(baseProject(), { scope: "content" });
    expect(report.sections.content_policy_delegated?.ok).toBe(true);
  });
});
