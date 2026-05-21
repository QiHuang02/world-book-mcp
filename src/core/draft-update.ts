import type { z } from "zod";
import type { DraftEntryPatchSchema } from "../schemas/worldbook-draft.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export type DraftEntryPatch = z.infer<typeof DraftEntryPatchSchema>;

export function updateDraftEntries(entries: WorldbookDraftEntry[], patches: DraftEntryPatch[]): WorldbookDraftEntry[] {
  const next = entries.map((entry) => ({ ...entry, keys: [...entry.keys], secondaryKeys: [...entry.secondaryKeys] }));

  for (const patch of patches) {
    const index = resolvePatchIndex(next, patch);
    const current = next[index];
    next[index] = {
      ...current,
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.keys !== undefined ? { keys: patch.keys } : {}),
      ...(patch.secondaryKeys !== undefined ? { secondaryKeys: patch.secondaryKeys } : {}),
      ...(patch.constant !== undefined ? { constant: patch.constant } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.depth !== undefined ? { depth: patch.depth } : {}),
      ...(patch.scanDepth !== undefined ? { scanDepth: patch.scanDepth ?? undefined } : {}),
      preventRecursion: true,
      excludeRecursion: true,
    };
  }

  return next;
}

function resolvePatchIndex(entries: WorldbookDraftEntry[], patch: DraftEntryPatch): number {
  if (patch.index !== undefined) {
    if (!entries[patch.index]) throw new Error(`未找到 index=${patch.index} 的草稿条目`);
    return patch.index;
  }
  const index = entries.findIndex((entry) => entry.comment === patch.comment);
  if (index === -1) throw new Error(`未找到 comment=${patch.comment} 的草稿条目`);
  return index;
}
