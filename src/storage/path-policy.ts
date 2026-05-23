import fs from "node:fs/promises";
import path from "node:path";

export const ROOT_DIR = process.cwd();
export const EXPORTS_DIR = path.resolve(ROOT_DIR);
export const BACKUPS_DIR = path.resolve(ROOT_DIR, ".worldbook", "backups");
export const CARDS_DIR = path.resolve(ROOT_DIR);

export function assertInside(baseDir: string, candidate: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径不允许越界: ${candidate}`);
  }
  return resolvedCandidate;
}

export function resolveExportPath(outputPath: string | undefined, fallbackName: string): string {
  const filename = outputPath?.trim() || `${sanitizeFilename(fallbackName)}.json`;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(EXPORTS_DIR, filename);
  return assertInside(EXPORTS_DIR, resolved);
}

export function resolveReadableWorldbookPath(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT_DIR, inputPath);
  return assertInside(ROOT_DIR, resolved);
}

export function resolveBackupPath(originalPath: string, timestamp = new Date()): string {
  const parsed = path.parse(originalPath);
  const safeBase = sanitizeFilename(parsed.name || "worldbook");
  const stamp = timestamp.toISOString().replace(/[:.]/g, "-");
  return assertInside(BACKUPS_DIR, path.resolve(BACKUPS_DIR, `${safeBase}.${stamp}.bak.json`));
}

export function resolveCardExportPath(outputPath: string | undefined, fallbackName: string): string {
  const filename = outputPath?.trim() || `${sanitizeFilename(fallbackName)}.json`;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(CARDS_DIR, filename);
  return assertInside(CARDS_DIR, resolved);
}

export function resolveReadableCardPath(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT_DIR, inputPath);
  return assertInside(ROOT_DIR, resolved);
}

export async function backupIfExists(originalPath: string): Promise<string | undefined> {
  try {
    await fs.access(originalPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const backupPath = resolveBackupPath(originalPath);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(originalPath, backupPath);
  return backupPath;
}

export async function writeTempThenCommit(input: { targetPath: string; content: string; tempId: string; overwrite?: boolean; commit: () => Promise<void>; backup?: boolean }): Promise<{ backupPath?: string }> {
  const targetPath = path.resolve(input.targetPath);
  const overwrite = input.overwrite ?? false;
  const targetExists = await fileExists(targetPath);
  if (!overwrite && targetExists) {
    const error = new Error(`文件已存在: ${targetPath}`) as NodeJS.ErrnoException;
    error.code = "EEXIST";
    throw error;
  }

  const tempPath = assertInside(path.dirname(targetPath), path.resolve(path.dirname(targetPath), `.${path.basename(targetPath)}.tmp.${sanitizeFilename(input.tempId)}`));
  await writeTextFileSafely(tempPath, input.content, { overwrite: false });

  let backupPath: string | undefined;
  try {
    if (input.backup && targetExists) backupPath = await backupIfExists(targetPath);
    if (overwrite) await fs.rm(targetPath, { force: true });
    await fs.rename(tempPath, targetPath);
    try {
      await input.commit();
    } catch (error) {
      await restoreAfterCommitFailure({ targetPath, backupPath, hadOriginal: targetExists });
      throw error;
    }
    return { backupPath };
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

async function restoreAfterCommitFailure(input: { targetPath: string; backupPath?: string; hadOriginal: boolean }): Promise<void> {
  if (input.backupPath) {
    await fs.copyFile(input.backupPath, input.targetPath);
    return;
  }
  if (!input.hadOriginal) {
    await fs.rm(input.targetPath, { force: true });
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "worldbook";
}

const fileWriteQueues = new Map<string, Promise<unknown>>();

export async function writeTextFileSafely(filePath: string, content: string, options: { overwrite?: boolean } = {}): Promise<void> {
  const resolved = path.resolve(filePath);
  const overwrite = options.overwrite ?? false;
  if (!overwrite) {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
    return;
  }

  const previous = fileWriteQueues.get(resolved) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf8");
  });
  fileWriteQueues.set(resolved, next.finally(() => {
    if (fileWriteQueues.get(resolved) === next) fileWriteQueues.delete(resolved);
  }));
  return next;
}
