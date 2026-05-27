import fs from "node:fs/promises";
import path from "node:path";
import { DraftSliceDataSchemas, DraftSliceSchema, type DraftSlice, type DraftType } from "../schemas/draft-slice.js";
import { SharedRegistrySchema, type SharedCategory, type SharedRegistry, type SharedRegistryEntry } from "../schemas/shared.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { assertInside, sanitizeFilename } from "./path-policy.js";
import { canonicalSliceId, draftSlicePath, readDraftSlice, upsertDraftSlice } from "./draft-store.js";
import { WORKSPACE_DIR } from "./workspace-store.js";

export const SHARED_DIR = path.resolve(WORKSPACE_DIR, "shared");
export const SHARED_ENTRIES_DIR = path.resolve(SHARED_DIR, "entries");
export const SHARED_ASSETS_DIR = path.resolve(SHARED_DIR, "assets");
export const SHARED_REGISTRY_PATH = path.resolve(SHARED_DIR, "registry.json");

export function sharedCategoryForType(type: DraftType): SharedCategory { return type === "entry" ? "entries" : "assets"; }
function sharedDirForCategory(category: SharedCategory): string { return category === "entries" ? SHARED_ENTRIES_DIR : SHARED_ASSETS_DIR; }
function sharedSlicePath(category: SharedCategory, id: string): string { const dir = sharedDirForCategory(category); return assertInside(dir, path.resolve(dir, `${sanitizeFilename(id)}.json`)); }

export async function ensureSharedDirs(): Promise<void> { await fs.mkdir(SHARED_ENTRIES_DIR, { recursive: true }); await fs.mkdir(SHARED_ASSETS_DIR, { recursive: true }); }
export async function readSharedRegistry(): Promise<SharedRegistry> { await ensureSharedDirs(); try { return await readJsonFile(SHARED_REGISTRY_PATH, SharedRegistrySchema); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 2, entries: [] }; throw error; } }
export async function writeSharedRegistry(registry: SharedRegistry): Promise<void> { await ensureSharedDirs(); await writeJsonFile(SHARED_REGISTRY_PATH, SharedRegistrySchema.parse(registry)); }

export async function shareSlice(input: { slug: string; type: DraftType; id: string; sharedId?: string; title?: string; overwrite?: boolean }): Promise<{ entry: SharedRegistryEntry; path: string; slice: DraftSlice }> {
  await ensureSharedDirs();
  const sourceId = canonicalSliceId(input.type, input.id);
  const slice = await readDraftSlice(input.slug, input.type, sourceId);
  const category = sharedCategoryForType(slice.type);
  const sharedId = input.sharedId ?? `${input.slug}-${slice.id}`;
  const outputPath = sharedSlicePath(category, sharedId);
  const registry = await readSharedRegistry();
  if (registry.entries.some((entry) => entry.id === sharedId) && !input.overwrite) throw new Error(`共享切片 ${sharedId} 已存在；如需覆盖请设置 overwrite=true`);
  const sharedSlice = DraftSliceSchema.parse({ ...slice, id: sharedId, title: input.title ?? slice.title ?? slice.id, source: "shared", origin: { kind: "shared", sharedId, sourceProject: input.slug, sourceSliceId: slice.id, usedAt: nowIso() }, data: DraftSliceDataSchemas[slice.type].parse(slice.data), revision: 0, updatedAt: nowIso() });
  await writeJsonFile(outputPath, sharedSlice);
  const entry: SharedRegistryEntry = { id: sharedId, type: sharedSlice.type, category, title: sharedSlice.title ?? sharedId, source_project: input.slug, shared_at: nowIso(), file: path.relative(SHARED_DIR, outputPath).replace(/\\/g, "/") };
  registry.entries = [...registry.entries.filter((item) => item.id !== sharedId), entry].sort((a, b) => a.id.localeCompare(b.id, "zh-Hans-CN"));
  await writeSharedRegistry(registry);
  return { entry, path: outputPath, slice: sharedSlice };
}

export async function useShared(input: { slug: string; sharedId: string; targetId?: string; overwrite?: boolean }): Promise<{ registry_entry: SharedRegistryEntry; path: string; slice: DraftSlice }> {
  const registry = await readSharedRegistry();
  const registryEntry = registry.entries.find((entry) => entry.id === input.sharedId);
  if (!registryEntry) throw new Error(`未找到共享切片 ${input.sharedId}`);
  const sourcePath = assertInside(SHARED_DIR, path.resolve(SHARED_DIR, registryEntry.file));
  const sharedSlice = await readJsonFile(sourcePath, DraftSliceSchema);
  const targetId = canonicalSliceId(sharedSlice.type, input.targetId ?? sharedSlice.id);
  if (!input.overwrite) {
    try { await fs.access(draftSlicePath(input.slug, sharedSlice.type, targetId)); throw new Error(`目标切片 ${sharedSlice.type}/${targetId} 已存在；如需覆盖请设置 overwrite=true`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const now = nowIso();
  const targetSlice = DraftSliceSchema.parse({ ...sharedSlice, id: targetId, source: "shared", origin: { kind: "shared", sharedId: input.sharedId, sourceProject: registryEntry.source_project, sourceSliceId: sharedSlice.id, usedAt: now }, createdAt: now, updatedAt: now, revision: 0 });
  const written = await upsertDraftSlice(input.slug, targetSlice);
  return { registry_entry: registryEntry, path: written.path, slice: written.slice };
}

export async function listShared(input: { type?: DraftType; category?: SharedCategory; includeContent?: boolean } = {}): Promise<Array<SharedRegistryEntry & { path: string; slice?: DraftSlice }>> {
  const registry = await readSharedRegistry();
  const entries = registry.entries.filter((entry) => (!input.type || entry.type === input.type) && (!input.category || entry.category === input.category));
  const result: Array<SharedRegistryEntry & { path: string; slice?: DraftSlice }> = [];
  for (const entry of entries) {
    const filePath = assertInside(SHARED_DIR, path.resolve(SHARED_DIR, entry.file));
    result.push({ ...entry, path: filePath, ...(input.includeContent ? { slice: await readJsonFile(filePath, DraftSliceSchema) } : {}) });
  }
  return result;
}
