import { describe, expect, it } from "vitest";
import { lintProjectContent } from "../src/core/project-lint.js";
import type { Project } from "../src/schemas/project.js";

describe("lintProjectContent", () => {
  it("scans draft and greetings", () => {
    const project: Project = {
      id: "project_test",
      name: "测试",
      pendingDecisions: [],
      recordedDecisions: [],
      revision: 0,
      plan: { enabled_assets: {} },
      imports: [],
      draft: [{
        comment: "条目",
        entryType: "other",
        keys: ["条目"],
        secondaryKeys: [],
        content: "一抹笑意",
        constant: false,
        position: "after_char",
        order: 1,
        enabled: true,
        preventRecursion: true,
        excludeRecursion: true,
      }],
      characterCardConfig: {
        card: {
          name: "角色A",
          description: "",
          personality: "",
          scenario: "",
          first_mes: "一丝风吹过。",
          alternate_greetings: [],
          creator_notes: "",
          system_prompt: "",
          post_history_instructions: "",
          tags: [],
          creator: "",
          character_version: "1.0",
          talkativeness: "0.5",
        },
        worldbook: { source: "project_draft" },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = lintProjectContent(project);
    expect(result.ok).toBe(false);
    expect(result.summary.scanned_target_count).toBeGreaterThan(1);
    expect(result.issues.some((issue) => issue.path.includes("first_mes"))).toBe(true);
  });

  it("flags dash variants and common micro-expression cliches", () => {
    const project: Project = {
      id: "project_test",
      name: "测试",
      pendingDecisions: [],
      recordedDecisions: [],
      revision: 0,
      plan: { enabled_assets: {} },
      imports: [],
      draft: [{
        comment: "条目",
        entryType: "other",
        keys: ["条目"],
        secondaryKeys: [],
        content: "他嘴角上扬—眸光落在门边。",
        constant: false,
        position: "after_char",
        order: 1,
        enabled: true,
        preventRecursion: true,
        excludeRecursion: true,
      }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = lintProjectContent(project);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.term === "—")).toBe(true);
    // 破折号本身现在是 warning（避免误判正常排版），但 嘴角上扬 仍然是 error。
    expect(result.issues.find((issue) => issue.term === "—")?.severity).toBe("warning");
    expect(result.issues.some((issue) => issue.term === "嘴角上扬" && issue.severity === "error")).toBe(true);
  });

  it("downgrades em-dash to warning when only punctuation is flagged", () => {
    const project: Project = {
      id: "project_test",
      name: "破折号测试",
      pendingDecisions: [],
      recordedDecisions: [],
      revision: 0,
      plan: { enabled_assets: {} },
      imports: [],
      draft: [{
        comment: "条目",
        entryType: "other",
        keys: ["条目"],
        secondaryKeys: [],
        content: "他靠在门边——风从远处吹过。",
        constant: false,
        position: "after_char",
        order: 1,
        enabled: true,
        preventRecursion: true,
        excludeRecursion: true,
      }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = lintProjectContent(project);
    // 只有 —— 时，issues 全部是 warning，ok 应为 true。
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.ok).toBe(true);
  });
});
