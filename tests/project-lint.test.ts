import { describe, expect, it } from "vitest";
import { lintProjectContent } from "../src/core/project-lint.js";
import type { Project } from "../src/schemas/project.js";

describe("lintProjectContent", () => {
  it("scans draft and greetings", () => {
    const project: Project = {
      id: "project_test",
      name: "测试",
      patches: [],
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
});
