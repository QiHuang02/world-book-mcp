import { describe, expect, it } from "vitest";
import { applyCharacterGreetingsUpdate, applyCharacterProfileUpdate } from "../src/core/character-card-project-editor.js";
import { hydrateProjectDraft } from "../src/core/project-draft-aggregate.js";
import type { Project } from "../src/schemas/project.js";
import { initWorkspaceProject, WORKSPACE_DIR } from "../src/storage/workspace-store.js";
import { writeProjectJson } from "../src/storage/workspace-store.js";
import fs from "node:fs/promises";

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project_test",
    slug: "project-test",
    name: "测试角色",
    pendingDecisions: [],
    recordedDecisions: [],
    revision: 0,
    plan: { enabled_assets: {}, output_target: "character_card" },
    imports: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

describe("character card project editor", () => {
  it("updates project profile while keeping description empty by default", () => {
    const updated = applyCharacterProfileUpdate(baseProject(), { name: "角色A", tags: ["原创"], include_worldbook: true });

    expect(updated.profile?.name).toBe("角色A");
    expect(updated.profile?.description).toBe("");
    expect(updated.profile?.worldbook_name).toBe("测试角色世界书");
  });

  it("updates greetings separately and hydrates characterCardConfig", async () => {
    await cleanupWorkspace();
    const { project, slug } = await initWorkspaceProject({ name: "角色卡编辑", output: "character_card", source: "original", opening: { mode: "event_hook", user_role: "unspecified", premise: "角色B在门口遇见 user。", user_constraints: [] }, ifExists: "error" });
    const withProfile = applyCharacterProfileUpdate(project, { name: "角色B", include_worldbook: false });
    const withGreetings = applyCharacterGreetingsUpdate(withProfile, { first_mes: "夜里，角色B站在门口，看向你。", alternate_greetings: ["雨声落在窗边，你听见角色B开口。", "清晨，角色B把一封信递给你。"] });
    await writeProjectJson(slug, withGreetings);

    const { project: hydrated } = await hydrateProjectDraft(withGreetings, slug);

    expect(hydrated.characterCardConfig?.card.name).toBe("角色B");
    expect(hydrated.characterCardConfig?.card.first_mes).toContain("角色B");
    expect(hydrated.characterCardConfig?.card.alternate_greetings).toHaveLength(2);
    expect(hydrated.characterCardConfig?.worldbook.source).toBe("none");
    await cleanupWorkspace();
  });
});
