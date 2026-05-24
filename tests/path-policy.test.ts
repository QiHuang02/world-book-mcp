import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { backupIfExists, resolveBackupPath, resolveCardExportPath, resolveExportPath, resolveReadableCardPath, resolveReadableWorldbookPath, ROOT_DIR, writeTempThenCommit, writeTextFileSafely } from "../src/storage/path-policy.js";

describe("path policy", () => {
  it("rejects paths outside exports", () => {
    expect(() => resolveReadableWorldbookPath("../../package.json")).toThrow("路径不允许越界");
  });

  it("accepts relative export paths", () => {
    expect(resolveReadableWorldbookPath("demo.json").replace(/\\/g, "/")).toContain("/world-book-mcp/demo.json");
  });

  it("creates backup paths inside workspace backups directory", () => {
    const backup = resolveBackupPath("demo.json", new Date("2026-01-01T00:00:00.000Z")).replace(/\\/g, "/");
    expect(backup).toContain("/world-book-mcp/.worldbook/backups/demo.2026-01-01T00-00-00-000Z.bak.json");
  });

  it("rejects card paths outside cards directory", () => {
    expect(() => resolveReadableCardPath("../demo.json")).toThrow("路径不允许越界");
  });

  it("defaults export paths to the current working directory", () => {
    expect(resolveExportPath(undefined, "世界书").replace(/\\/g, "/")).toContain("/world-book-mcp/世界书.json");
    expect(resolveCardExportPath(undefined, "角色卡").replace(/\\/g, "/")).toContain("/world-book-mcp/角色卡.json");
  });

  it("rejects out-of-bound export paths", () => {
    expect(() => resolveExportPath("../escape.json", "x")).toThrow("路径不允许越界");
    expect(() => resolveCardExportPath("../escape.json", "x")).toThrow("路径不允许越界");
  });

  it("exclusively creates files when overwrite is false", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-write-safe-exclusive.json");
    await fs.rm(target, { force: true });
    await writeTextFileSafely(target, "first", { overwrite: false });
    await expect(writeTextFileSafely(target, "second", { overwrite: false })).rejects.toMatchObject({ code: "EEXIST" });
    await expect(fs.readFile(target, "utf8")).resolves.toBe("first");
    await fs.rm(target, { force: true });
  });

  it("serializes writes to the same path when overwrite is true", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-write-safe-queue.json");
    await fs.rm(target, { force: true });
    await Promise.all([
      writeTextFileSafely(target, "one", { overwrite: true }),
      writeTextFileSafely(target, "two", { overwrite: true }),
      writeTextFileSafely(target, "three", { overwrite: true }),
    ]);
    const final = await fs.readFile(target, "utf8");
    expect(["one", "two", "three"]).toContain(final);
    await fs.rm(target, { force: true });
  });

  it("backs up existing files only when they exist", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-backup-source.json");
    await fs.rm(target, { force: true });
    await expect(backupIfExists(target)).resolves.toBeUndefined();
    await fs.writeFile(target, "backup me", "utf8");
    const backup = await backupIfExists(target);
    expect(backup).toBeTruthy();
    await expect(fs.readFile(backup!, "utf8")).resolves.toBe("backup me");
    await fs.rm(target, { force: true });
    await fs.rm(backup!, { force: true });
  });

  it("commits temp file only after commit succeeds", async () => {
    const target = path.resolve(ROOT_DIR, "tmp-transaction-target.json");
    await fs.rm(target, { force: true });
    await expect(writeTempThenCommit({ targetPath: target, content: "new", tempId: "fail", commit: async () => { throw new Error("boom"); } })).rejects.toThrow("boom");
    await expect(fs.access(target)).rejects.toThrow();
    await writeTempThenCommit({ targetPath: target, content: "new", tempId: "ok", commit: async () => undefined });
    await expect(fs.readFile(target, "utf8")).resolves.toBe("new");
    await fs.rm(target, { force: true });
  });

  it("rejects export paths that resolve to protected directories", () => {
    expect(() => resolveExportPath("src/escape.json", "x")).toThrow(/受保护目录/);
    expect(() => resolveExportPath("node_modules/escape.json", "x")).toThrow(/受保护目录/);
    expect(() => resolveExportPath(".git/escape.json", "x")).toThrow(/受保护目录/);
    expect(() => resolveCardExportPath("dist/escape.json", "x")).toThrow(/受保护目录/);
  });

  it("rejects export paths inside .worldbook directory", () => {
    expect(() => resolveExportPath(".worldbook/project.json", "x")).toThrow(/受保护目录/);
    expect(() => resolveExportPath(".worldbook/plan.md", "x")).toThrow(/受保护目录/);
    expect(() => resolveExportPath(".worldbook/draft/worldbook/entry.json", "x")).toThrow(/受保护目录/);
    expect(() => resolveCardExportPath(".worldbook/exports/card.json", "x")).toThrow(/受保护目录/);
  });

  it("rejects export paths that target known project metadata files", () => {
    expect(() => resolveExportPath("package.json", "x")).toThrow(/项目元数据文件/);
    expect(() => resolveCardExportPath("tsconfig.json", "x")).toThrow(/项目元数据文件/);
  });

  it("still allows project-root JSON files that are not protected", () => {
    expect(() => resolveExportPath("世界书.json", "x")).not.toThrow();
    expect(() => resolveCardExportPath("角色卡.json", "x")).not.toThrow();
  });
});
