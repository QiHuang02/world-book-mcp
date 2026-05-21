import { describe, expect, it } from "vitest";
import { resolveBackupPath, resolveReadableCardPath, resolveReadableWorldbookPath } from "../src/storage/path-policy.js";

describe("path policy", () => {
  it("rejects paths outside exports", () => {
    expect(() => resolveReadableWorldbookPath("../../package.json")).toThrow("路径不允许越界");
  });

  it("accepts relative export paths", () => {
    expect(resolveReadableWorldbookPath("demo.json").replace(/\\/g, "/")).toContain("/output/exports/demo.json");
  });

  it("creates backup paths inside backups directory", () => {
    const backup = resolveBackupPath("demo.json", new Date("2026-01-01T00:00:00.000Z")).replace(/\\/g, "/");
    expect(backup).toContain("/output/exports/backups/demo.2026-01-01T00-00-00-000Z.bak.json");
  });

  it("rejects card paths outside cards directory", () => {
    expect(() => resolveReadableCardPath("../demo.json")).toThrow("路径不允许越界");
  });
});
