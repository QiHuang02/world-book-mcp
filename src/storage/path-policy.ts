import path from "node:path";

export const ROOT_DIR = process.cwd();
export const OUTPUT_DIR = path.resolve(ROOT_DIR, "output");
export const PROJECTS_DIR = path.resolve(OUTPUT_DIR, "projects");
export const EXPORTS_DIR = path.resolve(OUTPUT_DIR, "exports");
export const BACKUPS_DIR = path.resolve(EXPORTS_DIR, "backups");
export const CARDS_DIR = path.resolve(EXPORTS_DIR, "cards");

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
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(EXPORTS_DIR, inputPath);
  return assertInside(EXPORTS_DIR, resolved);
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
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(CARDS_DIR, inputPath);
  return assertInside(CARDS_DIR, resolved);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "worldbook";
}
