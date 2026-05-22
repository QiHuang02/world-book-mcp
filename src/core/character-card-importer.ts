import fs from "node:fs/promises";
import { CharacterCardConfigSchema, type CharacterCardConfig } from "../schemas/character-card.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { safeJsonParse } from "../utils/json.js";

interface ImportedCharacterCardJson {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  creatorcomment?: string;
  talkativeness?: string;
  tags?: string[];
  spec?: string;
  spec_version?: string;
  data?: {
    name?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    tags?: string[];
    creator?: string;
    character_version?: string;
    alternate_greetings?: string[];
    extensions?: { talkativeness?: string };
    character_book?: {
      name?: string;
      entries?: ImportedCharacterBookEntry[];
    };
  };
}

interface ImportedCharacterBookEntry {
  keys?: string[];
  key?: string[];
  secondary_keys?: string[];
  keysecondary?: string[];
  comment?: string;
  content?: string;
  constant?: boolean;
  insertion_order?: number;
  order?: number;
  enabled?: boolean;
  disable?: boolean;
  position?: string | number;
  depth?: number;
  scanDepth?: number | null;
  scan_depth?: number | null;
  extensions?: {
    position?: number;
    depth?: number;
    scan_depth?: number | null;
    scanDepth?: number | null;
    prevent_recursion?: boolean;
    exclude_recursion?: boolean;
  };
}

export async function importCharacterCardFromFile(filePath: string): Promise<{ card: ImportedCharacterCardJson; config: CharacterCardConfig; draft: WorldbookDraftEntry[] }> {
  const text = await fs.readFile(filePath, "utf8");
  return characterCardToProjectData(safeJsonParse<ImportedCharacterCardJson>(text));
}

export function characterCardToProjectData(card: ImportedCharacterCardJson): { card: ImportedCharacterCardJson; config: CharacterCardConfig; draft: WorldbookDraftEntry[] } {
  const data = card.data ?? {};
  const characterBook = data.character_book;
  const config = CharacterCardConfigSchema.parse({
    card: {
      name: data.name ?? card.name ?? "角色卡",
      description: data.description ?? card.description ?? "",
      personality: data.personality ?? card.personality ?? "",
      scenario: data.scenario ?? card.scenario ?? "",
      first_mes: data.first_mes ?? card.first_mes ?? "",
      alternate_greetings: data.alternate_greetings ?? [],
      creator_notes: data.creator_notes ?? card.creatorcomment ?? "",
      system_prompt: data.system_prompt ?? "",
      post_history_instructions: data.post_history_instructions ?? "",
      tags: data.tags ?? card.tags ?? [],
      creator: data.creator ?? "",
      character_version: data.character_version ?? "1.0",
      talkativeness: data.extensions?.talkativeness ?? card.talkativeness ?? "0.5",
    },
    worldbook: {
      source: characterBook ? "project_draft" : "none",
      name: characterBook?.name ?? data.name ?? card.name,
    },
  });
  return { card, config, draft: characterBookEntriesToDraft(characterBook?.entries ?? []) };
}

export function characterBookEntriesToDraft(entries: ImportedCharacterBookEntry[]): WorldbookDraftEntry[] {
  return entries.map((entry, index) => {
    const position = positionFromImportedEntry(entry);
    const scanDepth = entry.extensions?.scan_depth ?? entry.extensions?.scanDepth ?? entry.scanDepth ?? entry.scan_depth;
    const depth = entry.extensions?.depth ?? entry.depth;
    return {
      comment: entry.comment?.trim() || `角色卡条目_${index + 1}`,
      entryType: inferEntryType(entry.comment ?? "", entry.content ?? ""),
      keys: entry.keys ?? entry.key ?? [],
      secondaryKeys: entry.secondary_keys ?? entry.keysecondary ?? [],
      content: entry.content ?? "",
      constant: entry.constant ?? true,
      position,
      order: entry.insertion_order ?? entry.order ?? index,
      enabled: entry.enabled ?? (entry.disable !== undefined ? !entry.disable : true),
      ...(position === "at_depth" ? { depth: depth ?? 0 } : depth !== undefined ? { depth } : {}),
      ...(typeof scanDepth === "number" ? { scanDepth } : {}),
      preventRecursion: true,
      excludeRecursion: true,
    };
  });
}

function positionFromImportedEntry(entry: ImportedCharacterBookEntry): WorldbookDraftEntry["position"] {
  if (isPositionName(entry.position)) return entry.position;
  const numericPosition = typeof entry.position === "number" ? entry.position : entry.extensions?.position;
  switch (numericPosition) {
    case 0: return "before_char";
    case 1: return "after_char";
    case 2: return "before_an";
    case 3: return "after_an";
    case 4: return "at_depth";
    case 5: return "before_em";
    case 6: return "after_em";
    case 7: return "outlet";
    default: return "after_char";
  }
}

function isPositionName(value: unknown): value is WorldbookDraftEntry["position"] {
  return value === "before_char" || value === "after_char" || value === "before_an" || value === "after_an" || value === "at_depth" || value === "before_em" || value === "after_em" || value === "outlet";
}

function inferEntryType(comment: string, content: string): WorldbookDraftEntry["entryType"] {
  const haystack = `${comment}\n${content}`;
  if (/性格|personality/i.test(comment)) return "character_personality";
  if (/基础|基本|character|name\s*[:：]/i.test(haystack)) return "character_basic";
  return "other";
}
