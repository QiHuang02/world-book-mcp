import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrateLegacyWorkspaceIfNeeded } from "../src/core/workspace-migrator.js";
import { readDraftSlice } from "../src/storage/draft-store.js";
import { loadWorkspace, projectJsonPath, projectPlanPath, WORKSPACE_DIR, WORKSPACE_JSON_PATH } from "../src/storage/workspace-store.js";
import { readJsonFile, writeJsonFile } from "../src/utils/json.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

function oldSlice(input: { id: string; type: string; data: unknown; title?: string }) {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    enabled: true,
    data: input.data,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    revision: 0,
  };
}

describe("workspace migrator", () => {
  it("migrates legacy single-project workspace into v2 project layout", async () => {
    await cleanupWorkspace();
    await fs.mkdir(path.resolve(WORKSPACE_DIR, "draft", "worldbook"), { recursive: true });
    await fs.mkdir(path.resolve(WORKSPACE_DIR, "draft", "mvu"), { recursive: true });
    await fs.mkdir(path.resolve(WORKSPACE_DIR, "draft", "html"), { recursive: true });
    await fs.mkdir(path.resolve(WORKSPACE_DIR, "draft", "character-card"), { recursive: true });
    await fs.mkdir(path.resolve(WORKSPACE_DIR, "draft", "style"), { recursive: true });

    const legacyProject = {
      id: "project_legacy",
      name: "Legacy Card",
      pendingDecisions: [],
      recordedDecisions: [],
      revision: 0,
      plan: { enabled_assets: {}, output_target: "character_card" },
      imports: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "project.json"), legacyProject);
    await fs.writeFile(path.resolve(WORKSPACE_DIR, "plan.md"), "# old plan\n", "utf8");
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "worldbook", "entry.json"), oldSlice({ id: "entry", type: "worldbook_entry", data: { comment: "条目", entryType: "other", keys: ["条目"], secondaryKeys: [], content: "内容", constant: true, position: "before_char", order: 100, enabled: true, preventRecursion: true, excludeRecursion: true } }));
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "mvu", "schema.json"), oldSlice({ id: "schema", type: "mvu_schema", data: { enabled: true, style: "zod", schema_script: "export const Schema = z.object({})", variable_list_path: "stat_data" } }));
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "mvu", "rules.json"), oldSlice({ id: "rules", type: "mvu_update_rules", data: { enabled: true, initvar: "foo: 1", update_rules: "foo: check", hide_regex: true, beautify_regex: true } }));
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "html", "status.json"), oldSlice({ id: "status", type: "html_statusbar", data: { enabled: true, target: "statusbar", theme: "minimal", html: "<div></div>", hide_regex: true } }));
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "character-card", "profile.json"), oldSlice({ id: "profile", type: "character_profile", data: { name: "角色", description: "", personality: "", scenario: "", first_mes: "你好", alternate_greetings: [], creator_notes: "", system_prompt: "", post_history_instructions: "", tags: [], creator: "", character_version: "1.0", talkativeness: "0.5", include_worldbook: true, worldbook_name: "角色世界书" } }));
    await writeJsonFile(path.resolve(WORKSPACE_DIR, "draft", "character-card", "greetings.json"), oldSlice({ id: "greetings", type: "character_greetings", data: { first_mes: "你好", alternate_greetings: ["再见"] } }));

    const result = await migrateLegacyWorkspaceIfNeeded();
    expect(result.migrated).toBe(true);
    expect(result.slug).toBe("legacy-card");
    await expect(fs.access(WORKSPACE_JSON_PATH)).resolves.toBeUndefined();
    await expect(fs.access(path.resolve(WORKSPACE_DIR, "project.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(path.resolve(WORKSPACE_DIR, "draft"))).rejects.toMatchObject({ code: "ENOENT" });

    const workspace = await loadWorkspace();
    expect(workspace.default_project).toBe("legacy-card");
    const project = await readJsonFile(projectJsonPath("legacy-card")) as { profile?: { name: string }; greetings?: { alternate_greetings: string[] } };
    expect(project.profile?.name).toBe("角色");
    expect(project.greetings?.alternate_greetings).toEqual(["再见"]);
    expect(await fs.readFile(projectPlanPath("legacy-card"), "utf8")).toContain("old plan");
    expect((await readDraftSlice("legacy-card", "entry", "entry")).type).toBe("entry");
    expect((await readDraftSlice("legacy-card", "mvu", "mvu")).type).toBe("mvu");
    expect((await readDraftSlice("legacy-card", "html", "html")).type).toBe("html");
    await cleanupWorkspace();
  });
});
