import fs from "node:fs/promises";
import path from "node:path";

export const ROOT_DIR = process.cwd();
export const EXPORTS_DIR = path.resolve(ROOT_DIR);
export const CARDS_DIR = path.resolve(ROOT_DIR);

// 即便目标路径在仓库内，也禁止落到这些"几乎肯定不该被酒馆 JSON 覆盖"的目录里。
// 仅按目录命中：./src/* / ./node_modules/* / ./.git/* / ./dist/* / ./build/*。
const DENY_RELATIVE_DIRS = ["src", "node_modules", ".git", "dist", "build", ".worldbook"];

// 在 EXPORTS_DIR / CARDS_DIR 之外，禁止覆盖这些"项目级元数据"文件，避免误把酒馆 JSON 写到它们上面。
const PROTECTED_ROOT_FILES = new Set(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", "jsconfig.json", "biome.json", "vite.config.json", "turbo.json"]);

export function assertInside(baseDir: string, candidate: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径不允许越界: ${candidate}`);
  }
  return resolvedCandidate;
}

function assertNotInDeniedDir(resolved: string): void {
  const relative = path.relative(ROOT_DIR, resolved);
  // 已经过 assertInside(EXPORTS_DIR/CARDS_DIR/ROOT_DIR) 校验，这里只关心仓库内的子路径。
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0) return;
  for (const denied of DENY_RELATIVE_DIRS) {
    const deniedSegments = denied.split("/").filter(Boolean);
    if (segments.length < deniedSegments.length) continue;
    const matches = deniedSegments.every((segment, index) => segments[index] === segment);
    if (matches) {
      throw new Error(`路径落在受保护目录 ${denied}/ 中，请改用项目根目录: ${resolved}`);
    }
  }
}

function assertNotProtectedRootFile(resolved: string): void {
  const relative = path.relative(ROOT_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;
  // 只在仓库根目录直接命中受保护文件名时拒绝；子目录中允许同名文件。
  if (relative === path.basename(resolved) && PROTECTED_ROOT_FILES.has(path.basename(resolved))) {
    throw new Error(`不允许覆盖项目元数据文件 ${path.basename(resolved)}：请换一个文件名`);
  }
}

export function resolveExportPath(outputPath: string | undefined, fallbackName: string): string {
  const filename = outputPath?.trim() || `${sanitizeFilename(fallbackName)}.json`;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(EXPORTS_DIR, filename);
  const inside = assertInside(EXPORTS_DIR, resolved);
  assertNotInDeniedDir(inside);
  assertNotProtectedRootFile(inside);
  return inside;
}

export function resolveReadableWorldbookPath(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT_DIR, inputPath);
  return assertInside(ROOT_DIR, resolved);
}

export function resolveCardExportPath(outputPath: string | undefined, fallbackName: string): string {
  const filename = outputPath?.trim() || `${sanitizeFilename(fallbackName)}.json`;
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(CARDS_DIR, filename);
  const inside = assertInside(CARDS_DIR, resolved);
  assertNotInDeniedDir(inside);
  assertNotProtectedRootFile(inside);
  return inside;
}

export function resolveReadableCardPath(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(ROOT_DIR, inputPath);
  return assertInside(ROOT_DIR, resolved);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\|?*\u0000-\u001F]/g, "_").trim() || "worldbook";
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

export function resolveBackupPath(filePath: string, date = new Date()): string {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);
  const ext = path.extname(resolved);
  const base = path.basename(resolved, ext);
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  const backupDir = assertInside(path.resolve(ROOT_DIR, ".worldbook"), path.resolve(ROOT_DIR, ".worldbook", "backups"));
  return assertInside(backupDir, path.resolve(backupDir, `${sanitizeFilename(base)}.${stamp}.bak${ext || ".txt"}`));
}

export async function backupIfExists(filePath: string): Promise<string | undefined> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const backupPath = resolveBackupPath(filePath);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

export async function writeTempThenCommit(input: { targetPath: string; content: string; tempId?: string; commit: () => Promise<void> }): Promise<void> {
  const target = path.resolve(input.targetPath);
  const temp = path.resolve(path.dirname(target), `.${path.basename(target)}.${input.tempId ?? process.pid}.tmp`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temp, input.content, { encoding: "utf8", flag: "w" });
  try {
    await input.commit();
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}
