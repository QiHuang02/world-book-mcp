import type { EjsConfig } from "../schemas/ejs.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export function buildEjsEntries(ejs: EjsConfig): { worldbookEntries: WorldbookDraftEntry[] } {
  if (!ejs.enabled) return { worldbookEntries: [] };
  return {
    worldbookEntries: ejs.entries.map((entry) => ({
      comment: entry.name,
      entryType: "other",
      keys: entry.keys,
      secondaryKeys: [],
      content: entry.content,
      constant: entry.constant,
      position: entry.position,
      order: entry.order,
      enabled: entry.enabled,
      depth: entry.depth,
      scanDepth: entry.scanDepth,
      preventRecursion: true,
      excludeRecursion: true,
    })),
  };
}
