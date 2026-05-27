import fs from "node:fs/promises";
import path from "node:path";
import { DraftSliceDataSchemas, DraftSliceSchema, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { assertInside, sanitizeFilename } from "./path-policy.js";
import { projectSlicesDir } from "./workspace-store.js";

const DRAFT_TYPE_DIRS: Record<DraftType, string> = {
  entry: "entries",
  mvu: "assets",
  html: "assets",
  regex: "assets/regex",
  ejs: "assets/ejs",
};

const UNIQUE_DRAFT_DIRS = Array.from(new Set(Object.values(DRAFT_TYPE_DIRS)));

export function canonicalSliceId(type: DraftType, id?: string): string {
  if (type === "mvu" || type === "html") {
    if (id && id !== type) throw new Error(`${type} 是每项目唯一资产切片，id 必须为 ${type}`);
    return type;
  }
  if (!id?.trim()) throw new Error(`draft_type=${type} 需要提供 id`);
  return id;
}

export function draftTypeDir(slug: string, type: DraftType): string {
  const slicesDir = projectSlicesDir(slug);
  return assertInside(slicesDir, path.resolve(slicesDir, DRAFT_TYPE_DIRS[type]));
}

export function draftSlicePath(slug: string, type: DraftType, id: string): string {
  const dir = draftTypeDir(slug, type);
  return assertInside(dir, path.resolve(dir, `${sanitizeFilename(canonicalSliceId(type, id))}.json`));
}

export async function ensureDraftDirs(slug: string): Promise<void> {
  const slicesDir = projectSlicesDir(slug);
  await Promise.all(UNIQUE_DRAFT_DIRS.map((dir) => fs.mkdir(path.resolve(slicesDir, dir), { recursive: true })));
}

export function createDraftSlice(input: { type: DraftType; id?: string; title?: string; data: unknown; active?: boolean; source?: DraftSlice["source"]; origin?: DraftSlice["origin"]; tags?: string[]; notes?: string }): DraftSlice {
  const timestamp = nowIso();
  const id = canonicalSliceId(input.type, input.id);
  const schema = DraftSliceDataSchemas[input.type];
  return DraftSliceSchema.parse({
    schemaVersion: 1,
    id,
    type: input.type,
    title: input.title,
    active: input.active ?? true,
    source: input.source ?? "manual",
    origin: input.origin,
    tags: input.tags ?? [],
    notes: input.notes,
    data: schema.parse(input.data),
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 0,
  });
}

export async function readDraftSlice(slug: string, type: DraftType, id: string): Promise<DraftSlice> {
  return readJsonFile(draftSlicePath(slug, type, canonicalSliceId(type, id)), DraftSliceSchema);
}

export async function writeDraftSlice(slug: string, slice: DraftSlice): Promise<string> {
  await ensureDraftDirs(slug);
  const parsed = DraftSliceSchema.parse({ ...slice, id: canonicalSliceId(slice.type, slice.id), data: DraftSliceDataSchemas[slice.type].parse(slice.data) });
  const outputPath = draftSlicePath(slug, parsed.type, parsed.id);
  await writeJsonFile(outputPath, parsed);
  return outputPath;
}

export async function upsertDraftSlice(slug: string, slice: DraftSlice): Promise<{ path: string; slice: DraftSlice }> {
  return enqueueDraftWrite(slug, slice.type, slice.id, async () => {
    let next = slice;
    try {
      const existing = await readDraftSlice(slug, slice.type, slice.id);
      next = DraftSliceSchema.parse({ ...slice, createdAt: existing.createdAt, updatedAt: nowIso(), revision: existing.revision + 1 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { path: await writeDraftSlice(slug, next), slice: next };
  });
}

export async function updateDraftSliceWithRevisionCheck(slug: string, type: DraftType, id: string, expectedRevision: number | undefined, mutator: (slice: DraftSlice) => DraftSlice): Promise<{ path: string; slice: DraftSlice }> {
  const canonical = canonicalSliceId(type, id);
  return enqueueDraftWrite(slug, type, canonical, async () => {
    const existing = await readDraftSlice(slug, type, canonical);
    if (expectedRevision !== undefined && existing.revision !== expectedRevision) throw new Error(`draft slice revision 冲突：expected=${expectedRevision}, actual=${existing.revision}`);
    const next = mutator(existing);
    const parsed = DraftSliceSchema.parse({ ...next, id: canonicalSliceId(next.type, next.id), createdAt: existing.createdAt, updatedAt: nowIso(), revision: existing.revision + 1 });
    return { path: await writeDraftSlice(slug, parsed), slice: parsed };
  });
}

const draftWriteQueues = new Map<string, Promise<unknown>>();
function enqueueDraftWrite<T>(slug: string, type: DraftType, id: string, operation: () => Promise<T>): Promise<T> {
  const key = `${slug}::${type}::${id}`;
  const previous = draftWriteQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  draftWriteQueues.set(key, next.finally(() => { if (draftWriteQueues.get(key) === next) draftWriteQueues.delete(key); }));
  return next;
}

export async function listDraftSlices(slug: string, type?: DraftType): Promise<DraftSlice[]> {
  await ensureDraftDirs(slug);
  const types = type ? [type] : Object.keys(DRAFT_TYPE_DIRS) as DraftType[];
  const slices: DraftSlice[] = [];
  for (const currentType of types) {
    const dir = draftTypeDir(slug, currentType);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const file of files.filter((item) => item.endsWith(".json")).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
      const slice = await readJsonFile(path.join(dir, file), DraftSliceSchema);
      if (slice.type === currentType) slices.push(slice);
    }
  }
  return slices;
}

export async function deleteDraftSlice(slug: string, type: DraftType, id: string): Promise<string> {
  const outputPath = draftSlicePath(slug, type, canonicalSliceId(type, id));
  try { await fs.unlink(outputPath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return outputPath;
}
