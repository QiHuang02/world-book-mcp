import path from "node:path";

export const ROOT_DIR = process.cwd();
export const OUTPUT_DIR = path.resolve(ROOT_DIR, "output");
export const PROJECTS_DIR = path.resolve(OUTPUT_DIR, "projects");
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

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "worldbook";
}

const fileWriteQueues = new Map<string, Promise<unknown>>();

export async function writeTextFileSafely(filePath: string, content: string, options: { overwrite?: boolean } = {}): Promise<void> {
  const resolved = path.resolve(filePath);
  const overwrite = options.overwrite ?? false;
  if (!overwrite) {
    await import("node:fs/promises").then(async (fs) => {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
    });
    return;
  }

  const previous = fileWriteQueues.get(resolved) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf8");
  });
  fileWriteQueues.set(resolved, next.finally(() => {
    if (fileWriteQueues.get(resolved) === next) fileWriteQueues.delete(resolved);
  }));
  return next;
}
