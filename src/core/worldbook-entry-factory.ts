import type { EntryType, PositionName, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export interface SimplifiedWorldbookEntryInput {
  comment: string;
  content: string;
  keys?: string[];
  secondary_keys?: string[];
  secondaryKeys?: string[];
  entry_type?: EntryType;
  entryType?: EntryType;
  position?: PositionName;
  order?: number;
  constant?: boolean;
  enabled?: boolean;
  depth?: number;
  scan_depth?: number | null;
  scanDepth?: number | null;
  character_name?: string;
  characterName?: string;
}

export function normalizeWorldbookEntry(input: SimplifiedWorldbookEntryInput, existing?: WorldbookDraftEntry): WorldbookDraftEntry {
  const entryType = input.entryType ?? input.entry_type ?? existing?.entryType ?? "other";
  const constant = input.constant ?? existing?.constant ?? true;
  const position = input.position ?? existing?.position ?? "before_char";
  const order = input.order ?? existing?.order ?? defaultOrderForEntryType(entryType);
  const secondaryKeys = input.secondaryKeys ?? input.secondary_keys ?? existing?.secondaryKeys ?? [];
  const scanDepthInput = input.scanDepth ?? input.scan_depth;
  const characterName = input.characterName ?? input.character_name ?? existing?.characterName;

  return {
    comment: input.comment.trim(),
    entryType,
    keys: uniqueStrings(input.keys ?? existing?.keys ?? [input.comment]),
    secondaryKeys: uniqueStrings(secondaryKeys),
    content: input.content,
    ...(characterName ? { characterName: characterName.trim() } : {}),
    constant,
    position,
    order,
    enabled: input.enabled ?? existing?.enabled ?? true,
    ...(input.depth !== undefined || existing?.depth !== undefined ? { depth: input.depth ?? existing?.depth } : {}),
    ...(scanDepthInput !== undefined
      ? scanDepthInput === null ? {} : { scanDepth: scanDepthInput }
      : existing?.scanDepth !== undefined ? { scanDepth: existing.scanDepth } : {}),
    preventRecursion: true,
    excludeRecursion: true,
  };
}

export function upsertWorldbookDraftEntry(entries: WorldbookDraftEntry[] | undefined, input: SimplifiedWorldbookEntryInput, options: { matchByKeys?: boolean } = {}): { entries: WorldbookDraftEntry[]; created: boolean; index: number; entry: WorldbookDraftEntry } {
  const current = entries ? [...entries] : [];
  const index = findEntryIndex(current, input, options);
  if (index >= 0) {
    const entry = normalizeWorldbookEntry(input, current[index]);
    current[index] = entry;
    return { entries: current, created: false, index, entry };
  }

  const entry = normalizeWorldbookEntry(input);
  current.push(entry);
  return { entries: current, created: true, index: current.length - 1, entry };
}

function findEntryIndex(entries: WorldbookDraftEntry[], input: SimplifiedWorldbookEntryInput, options: { matchByKeys?: boolean }): number {
  const normalizedComment = input.comment.trim();
  const byComment = entries.findIndex((entry) => entry.comment === normalizedComment);
  if (byComment >= 0) return byComment;

  if (!options.matchByKeys) return -1;
  const keys = new Set((input.keys ?? []).map((key) => key.trim()).filter(Boolean));
  if (keys.size === 0) return -1;
  return entries.findIndex((entry) => entry.keys.some((key) => keys.has(key)));
}

function defaultOrderForEntryType(entryType: EntryType): number {
  switch (entryType) {
    case "world_summary":
      return 1;
    case "background":
      return 10;
    case "character_overview":
      return 20;
    case "character_basic":
      return 30;
    case "character_personality":
      return 31;
    case "faction":
      return 40;
    case "item":
    case "ability":
      return 50;
    case "scene":
    case "event":
      return 60;
    case "npc":
      return 70;
    case "other":
    default:
      return 100;
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
