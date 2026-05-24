import { describe, expect, it } from "vitest";
import { sectionsForScope, validateProject } from "../src/core/project-validator.js";
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

describe("validateProject", () => {
  it("annotates report with scope_used", () => {
    const report = validateProject(baseProject(), { scope: "plan" });
    expect(report.scope_used).toBe("plan");
  });

  it("plan scope returns plan + pending_decisions sections only", () => {
    const report = validateProject(baseProject(), { scope: "plan" });
    expect(Object.keys(report.sections).sort()).toEqual(["pending_decisions", "plan"]);
  });

  it("content scope returns content_lint + writing_optimization (no content key)", () => {
    const report = validateProject(baseProject(), { scope: "content" });
    expect(Object.keys(report.sections).sort()).toEqual(["content_lint", "writing_optimization"]);
    expect(report.sections.content).toBeUndefined();
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
    const report = validateProject(project, { scope: "all" });
    expect(report.sections.plan?.errors).toHaveLength(0);
    expect(report.sections.plan?.warnings).toHaveLength(0);
    expect(report.sections.pending_decisions?.warnings).toHaveLength(1);
  });

  it("ready_to_export turns false when worldbook draft is empty for worldbook target", () => {
    const report = validateProject(baseProject(), { scope: "delivery", export_target: "worldbook" });
    expect(report.ready_to_export).toBe(false);
  });

  it("ready_to_export ignores empty worldbook for character_card target (downgraded to warning)", () => {
    const project = baseProject({
      characterCardConfig: {
        card: {
          name: "角色A",
          description: "",
          personality: "",
          scenario: "",
          first_mes: "夜里，角色A站在门口，看向你。",
          alternate_greetings: ["雨声落在窗边。", "远处传来钟声。"],
          creator_notes: "",
          system_prompt: "",
          post_history_instructions: "",
          tags: [],
          creator: "",
          character_version: "1.0",
          talkativeness: "0.5",
        },
        worldbook: { source: "none" },
      },
    });
    const report = validateProject(project, { scope: "delivery", export_target: "character_card" });
    expect(report.sections.worldbook?.errors).toHaveLength(0);
    expect(report.sections.worldbook?.warnings.length).toBeGreaterThan(0);
  });

  it("flags missing project name in plan section", () => {
    const project = baseProject({ name: "" });
    const report = validateProject(project, { scope: "plan" });
    expect(report.sections.plan?.errors.some((issue) => issue.code === "plan.name.empty")).toBe(true);
  });

  it("recommends record_user_decision when pending decisions exist", () => {
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
    const report = validateProject(project, { scope: "all" });
    expect(report.recommendations.some((line) => line.includes("record_user_decision"))).toBe(true);
  });
});

describe("sectionsForScope", () => {
  it("delivery scope covers all blocking sections", () => {
    const keys = sectionsForScope("delivery");
    expect(keys).toContain("plan");
    expect(keys).toContain("pending_decisions");
    expect(keys).toContain("worldbook");
    expect(keys).toContain("character_card");
    expect(keys).toContain("content_lint");
    expect(keys).toContain("writing_optimization");
  });

  it("content scope explicitly maps to content_lint + writing_optimization", () => {
    expect([...sectionsForScope("content")].sort()).toEqual(["content_lint", "writing_optimization"]);
  });
});
