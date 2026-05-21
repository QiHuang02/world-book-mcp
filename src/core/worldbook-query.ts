import fs from "node:fs/promises";
import { SillyTavernWorldbookSchema, type SillyTavernWorldbookEntry } from "../schemas/sillytavern-worldbook.js";
import { safeJsonParse } from "../utils/json.js";
import { resolveReadableWorldbookPath } from "../storage/path-policy.js";
import { numberToPosition } from "./position-map.js";

export type QueryMode = "brief" | "uid" | "search" | "stats";

export async function queryWorldbook(input: { path: string; mode: QueryMode; uid?: number; query?: string }): Promise<unknown> {
  const resolvedPath = resolveReadableWorldbookPath(input.path);
  const text = await fs.readFile(resolvedPath, "utf8");
  const book = SillyTavernWorldbookSchema.parse(safeJsonParse(text));
  const entries = Object.values(book.entries).sort((a, b) => a.uid - b.uid);

  switch (input.mode) {
    case "brief":
      return {
        name: book.name,
        entries: entries.map(toBrief),
      };
    case "uid": {
      const entry = entries.find((item) => item.uid === input.uid);
      if (!entry) throw new Error(`未找到 uid=${input.uid} 的条目`);
      return entry;
    }
    case "search": {
      const query = input.query?.toLowerCase();
      if (!query) throw new Error("search 模式需要 query");
      return {
        name: book.name,
        entries: entries.filter((entry) => searchable(entry).toLowerCase().includes(query)).map(toBrief),
      };
    }
    case "stats":
      return {
        name: book.name,
        entry_count: entries.length,
        constant_count: entries.filter((entry) => entry.constant).length,
        triggered_count: entries.filter((entry) => !entry.constant).length,
        disabled_count: entries.filter((entry) => entry.disable).length,
      };
  }
}

function toBrief(entry: SillyTavernWorldbookEntry): unknown {
  return {
    uid: entry.uid,
    comment: entry.comment,
    keys: entry.key,
    position: numberToPosition(entry.position) ?? entry.position,
    order: entry.order,
    constant: entry.constant,
    enabled: !entry.disable,
    preventRecursion: entry.preventRecursion,
    excludeRecursion: entry.excludeRecursion,
  };
}

function searchable(entry: SillyTavernWorldbookEntry): string {
  return [entry.comment, entry.content, ...entry.key, ...entry.keysecondary].join("\n");
}
