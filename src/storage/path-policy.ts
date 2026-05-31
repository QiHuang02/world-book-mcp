import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "../utils/ids.js";

export const ROOT_DIR = process.cwd();
export const WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");

const DENY_WRITE_DIRS = new Set([".git", "node_modules", "dist"]);
const PROTECTED_ROOT_FILES = new Set(["package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts"]);
const SOURCE_TOP_LEVEL_DIRS = new Set(["fields", "entries", "mvu", "html", "regex", "ejs", "tavern-helper", "references", "extraction"]);

export function assertInside(baseDir: string, candidate: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(candidate);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径不允许越界: ${candidate}`);
  }
  return resolved;
}

export function resolveProjectPath(projectPath: string, relativePath: string): string {
  return assertInside(projectPath, path.resolve(projectPath, relativePath));
}

export function resolveWorkspacePath(relativePath: string): string {
  return assertInside(WORKSPACE_DIR, path.resolve(WORKSPACE_DIR, relativePath));
}

export function assertSafeRootWrite(filePath: string): string {
  const resolved = assertInside(ROOT_DIR, path.resolve(filePath));
  const relative = path.relative(ROOT_DIR, resolved);
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  if (segments[0] && DENY_WRITE_DIRS.has(segments[0])) throw new Error(`不允许写入受保护目录: ${segments[0]}`);
  if (segments.length === 1 && PROTECTED_ROOT_FILES.has(segments[0])) throw new Error(`不允许覆盖项目元数据文件: ${segments[0]}`);
  return resolved;
}

export function resolveSourceFilePath(projectPath: string, sourceRoot: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error("source 文件路径必须是相对路径");
  if (relativePath.includes("\0")) throw new Error("source 文件路径不能包含空字符");
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").some((segment) => segment === "..")) throw new Error("source 文件路径不允许越界");
  const [topLevel] = normalized.split("/");
  if (!topLevel || !SOURCE_TOP_LEVEL_DIRS.has(topLevel)) throw new Error(`source 文件必须写入以下目录之一: ${Array.from(SOURCE_TOP_LEVEL_DIRS).join(", ")}`);
  const sourceDir = resolveProjectPath(projectPath, sourceRoot);
  return assertInside(sourceDir, path.resolve(sourceDir, normalized));
}

export function resolveDraftReference(projectPath: string, draftFilePath: string, reference: string): string {
  if (!reference.trim()) throw new Error("空路径引用");
  const base = path.dirname(draftFilePath);
  const resolved = path.isAbsolute(reference) ? reference : path.resolve(base, reference);
  return assertInside(projectPath, resolved);
}

export function resolveExportFilePath(projectPath: string, exportsRoot: string, outputPath: string | undefined, fallbackName: string): string {
  const exportsDir = resolveProjectPath(projectPath, exportsRoot);
  if (!outputPath) return assertInside(exportsDir, path.resolve(exportsDir, sanitizeFilename(fallbackName)));
  if (path.isAbsolute(outputPath)) throw new Error("导出路径必须是相对 exports/ 的路径");
  return assertInside(exportsDir, path.resolve(exportsDir, outputPath));
}

export function resolveReportFilePath(projectPath: string, reportsRoot: string, outputPath: string | undefined, fallbackName: string): string {
  const reportsDir = resolveProjectPath(projectPath, reportsRoot);
  if (!outputPath) return assertInside(reportsDir, path.resolve(reportsDir, sanitizeFilename(fallbackName)));
  if (path.isAbsolute(outputPath)) throw new Error("报告路径必须是相对 reports/ 的路径");
  return assertInside(reportsDir, path.resolve(reportsDir, outputPath));
}

export async function backupIfExists(filePath: string): Promise<string | undefined> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const ext = path.extname(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(WORKSPACE_DIR, "backups");
  const backupPath = assertInside(backupDir, path.resolve(backupDir, `${sanitizeFilename(path.basename(filePath, ext))}.${stamp}.bak${ext || ".txt"}`));
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}
