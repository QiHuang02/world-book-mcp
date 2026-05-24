import fs from "node:fs/promises";
import path from "node:path";
import { DraftSliceDataSchemas, DraftSliceSchema, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { assertInside, ROOT_DIR, sanitizeFilename } from "./path-policy.js";

export const DRAFT_WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook", "draft");

const DRAFT_TYPE_DIRS: Record<DraftType, string> = {
  worldbook_entry: "worldbook",
  character_profile: "character-card",
  character_greetings: "character-card",
  mvu_schema: "mvu",
  mvu_update_rules: "mvu",
  html_statusbar: "html",
  html_regex: "html",
  ejs_entry: "ejs",
  style_profile: "style",
  chapter_outline: "chapter",
};

const UNIQUE_DRAFT_DIRS = Array.from(new Set(Object.values(DRAFT_TYPE_DIRS)));

export function draftTypeDir(type: DraftType): string {
  return assertInside(DRAFT_WORKSPACE_DIR, path.resolve(DRAFT_WORKSPACE_DIR, DRAFT_TYPE_DIRS[type]));
}

export function draftSlicePath(type: DraftType, id: string): string {
  return assertInside(draftTypeDir(type), path.resolve(draftTypeDir(type), `${sanitizeFilename(id)}.json`));
}

export async function ensureDraftDirs(): Promise<void> {
  await Promise.all(UNIQUE_DRAFT_DIRS.map((dir) => fs.mkdir(path.resolve(DRAFT_WORKSPACE_DIR, dir), { recursive: true })));
}

export function createDraftSlice(input: { type: DraftType; id: string; title?: string; data: unknown; enabled?: boolean }): DraftSlice {
  const timestamp = nowIso();
  const schema = DraftSliceDataSchemas[input.type];
  return DraftSliceSchema.parse({
    id: input.id,
    type: input.type,
    title: input.title,
    enabled: input.enabled ?? true,
    data: schema.parse(input.data),
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 0,
  });
}

export async function readDraftSlice(type: DraftType, id: string): Promise<DraftSlice> {
  return readJsonFile(draftSlicePath(type, id), DraftSliceSchema);
}

export async function writeDraftSlice(slice: DraftSlice): Promise<string> {
  await ensureDraftDirs();
  const parsed = DraftSliceSchema.parse({ ...slice, data: DraftSliceDataSchemas[slice.type].parse(slice.data) });
  const outputPath = draftSlicePath(parsed.type, parsed.id);
  await writeJsonFile(outputPath, parsed);
  return outputPath;
}

export async function upsertDraftSlice(slice: DraftSlice): Promise<{ path: string; slice: DraftSlice }> {
  // 同一 (type, id) 的读 → 改 revision → 写需要串行化，避免并发 update_draft_field 调用
  // 出现 "后写覆盖前写 + revision 重复" 的情况。client 仍可使用 expected_slice_revision
  // 做协议层防御，这里是结构层兜底。
  return enqueueDraftWrite(slice.type, slice.id, async () => {
    let next = slice;
    try {
      const existing = await readDraftSlice(slice.type, slice.id);
      next = DraftSliceSchema.parse({ ...slice, createdAt: existing.createdAt, updatedAt: nowIso(), revision: existing.revision + 1 });
    } catch (error) {
      // Only a missing file means this is a create path; parse/schema errors must surface.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { path: await writeDraftSlice(next), slice: next };
  });
}

const draftWriteQueues = new Map<string, Promise<unknown>>();

function enqueueDraftWrite<T>(type: DraftType, id: string, operation: () => Promise<T>): Promise<T> {
  const key = `${type}::${id}`;
  const previous = draftWriteQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  draftWriteQueues.set(key, next.finally(() => {
    if (draftWriteQueues.get(key) === next) draftWriteQueues.delete(key);
  }));
  return next;
}

export async function listDraftSlices(type?: DraftType): Promise<DraftSlice[]> {
  await ensureDraftDirs();
  const types = type ? [type] : Object.keys(DRAFT_TYPE_DIRS) as DraftType[];
  const slices: DraftSlice[] = [];
  for (const currentType of types) {
    const dir = draftTypeDir(currentType);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const file of files.filter((item) => item.endsWith(".json")).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
      const slice = await readJsonFile(path.join(dir, file), DraftSliceSchema);
      if (slice.type === currentType) slices.push(slice);
    }
  }
  return slices;
}

export async function deleteDraftSlice(type: DraftType, id: string): Promise<string> {
  const outputPath = draftSlicePath(type, id);
  try {
    await fs.unlink(outputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return outputPath;
}

export async function clearDraftSlices(): Promise<void> {
  await fs.rm(DRAFT_WORKSPACE_DIR, { recursive: true, force: true });
  await ensureDraftDirs();
}
