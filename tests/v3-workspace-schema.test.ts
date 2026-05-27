import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkspace, WORKSPACE_DIR, WORKSPACE_JSON_PATH } from "../src/storage/workspace-store.js";

async function cleanupWorkspace(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
}

describe("v3 workspace schema gate", () => {
  it("accepts workspace version 3", async () => {
    await cleanupWorkspace();
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    await fs.writeFile(WORKSPACE_JSON_PATH, JSON.stringify({ version: 3, revision: 0, projects: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }), "utf8");

    const workspace = await loadWorkspace();
    expect(workspace.version).toBe(3);
    await cleanupWorkspace();
  });

  it("reports schema mismatch for non-v3 workspace files", async () => {
    await cleanupWorkspace();
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    await fs.writeFile(path.resolve(WORKSPACE_DIR, "workspace.json"), JSON.stringify({ version: 2 }), "utf8");

    await expect(loadWorkspace()).rejects.toThrow(/不符合 v3 schema/);
    await cleanupWorkspace();
  });
});
