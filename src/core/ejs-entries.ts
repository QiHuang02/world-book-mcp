import type { EjsConfig } from "../schemas/ejs.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export function buildEjsEntries(ejs: EjsConfig): { worldbookEntries: WorldbookDraftEntry[] } {
  return {
    worldbookEntries: ejs.entries.map((entry) => ({
      comment: entry.name,
      entryType: "other",
      keys: entry.keys,
      secondaryKeys: [],
      content: entry.content,
      constant: entry.role === "stage" ? false : entry.constant,
      position: entry.position,
      order: entry.order,
      enabled: entry.role === "stage" ? false : entry.enabled,
      depth: entry.depth,
      scanDepth: entry.scanDepth,
      preventRecursion: true,
      excludeRecursion: true,
    })),
  };
}
