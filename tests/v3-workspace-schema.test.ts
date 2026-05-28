import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dump } from "js-yaml";
import { loadWorkspace, WORKSPACE_DIR, WORKSPACE_YAML_PATH } from "../src/storage/workspace-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

describe("v4 workspace schema gate", () => {
  it("accepts workspace version 4 YAML", async () => {
    await cleanupWorkspace();
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    await fs.writeFile(WORKSPACE_YAML_PATH, dump({ version: 4, revision: 0, projects: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }), "utf8");

    const workspace = await loadWorkspace();
    expect(workspace.version).toBe(4);
    await cleanupWorkspace();
  });

  it("reports legacy JSON workspaces as unsupported", async () => {
    await cleanupWorkspace();
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    await fs.writeFile(path.resolve(WORKSPACE_DIR, "workspace.json"), JSON.stringify({ version: 3 }), "utf8");

    await expect(loadWorkspace()).rejects.toThrow(/v3 JSON 工作区/);
    await cleanupWorkspace();
  });
});
