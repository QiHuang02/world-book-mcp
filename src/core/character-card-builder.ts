import { randomUUID } from "node:crypto";
import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { HtmlBeautifyAssets } from "./html-beautify-assets.js";
import type { MvuAssets } from "./mvu-assets.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { uniqueStrings } from "../utils/strings.js";
import { positionToNumber } from "./position-map.js";

export interface CharacterCardJson {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creatorcomment: string;
  avatar: string;
  talkativeness: string;
  fav: boolean;
  tags: string[];
  spec: "chara_card_v3";
  spec_version: "3.0";
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    tags: string[];
    creator: string;
    character_version: string;
    alternate_greetings: string[];
    group_only_greetings: string[];
    extensions: {
      talkativeness: string;
      fav: boolean;
      world: string;
      depth_prompt: { prompt: string; depth: number; role: string };
      regex_scripts?: object[];
      tavern_helper?: unknown;
    };
    character_book: {
      name: string;
      entries: CharacterBookEntry[];
    };
  };
  create_date: string;
}

export interface CharacterBookEntry {
  id: number;
  keys: string[];
  secondary_keys: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  enabled: boolean;
  position: string;
  use_regex: boolean;
  extensions: Record<string, unknown>;
}

export function buildCharacterCardJson(input: {
  config: CharacterCardConfig;
  worldbookEntries?: WorldbookDraftEntry[];
  worldbookName?: string;
  mvuAssets?: MvuAssets;
  htmlAssets?: HtmlBeautifyAssets;
  ejsEntries?: WorldbookDraftEntry[];
  createdAt?: string;
}): CharacterCardJson {
  const card = input.config.card;
  const mvuWorldbookEntries = input.mvuAssets?.worldbookEntries ?? [];
  const sourceEntries = input.config.worldbook.source === "project_draft" ? input.worldbookEntries ?? [] : [];
  const ejsEntries = input.ejsEntries ?? [];
  const characterBookEntries = draftEntriesToCharacterBookEntries([...sourceEntries, ...mvuWorldbookEntries, ...ejsEntries]);
  const worldbookName = input.config.worldbook.name ?? input.worldbookName ?? card.name;
  const regexScripts = [
    ...(input.mvuAssets?.regexScripts ?? []),
    ...(input.htmlAssets?.regexScripts ?? []),
  ];
  const extensions: CharacterCardJson["data"]["extensions"] = {
    talkativeness: card.talkativeness,
    fav: false,
    world: card.name,
    depth_prompt: { prompt: "", depth: 4, role: "system" },
    ...(regexScripts.length ? { regex_scripts: regexScripts.map((script) => withId(script)) } : {}),
    ...(input.mvuAssets?.tavernHelperScripts.length ? { tavern_helper: [["scripts", input.mvuAssets.tavernHelperScripts.map((script) => withId(script))], ["variables", {}]] } : {}),
  };

  return {
    name: card.name,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    first_mes: card.first_mes,
    mes_example: "",
    creatorcomment: card.creator_notes,
    avatar: "none",
    talkativeness: card.talkativeness,
    fav: false,
    tags: card.tags,
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.first_mes,
      mes_example: "",
      creator_notes: card.creator_notes,
      system_prompt: card.system_prompt,
      post_history_instructions: card.post_history_instructions,
      tags: card.tags,
      creator: card.creator,
      character_version: card.character_version,
      alternate_greetings: card.alternate_greetings,
      group_only_greetings: [],
      extensions,
      character_book: {
        name: worldbookName,
        entries: characterBookEntries,
      },
    },
    create_date: input.createdAt ?? new Date().toISOString(),
  };
}

function withId<T extends object>(value: T): T & { id: string } {
  const maybeId = (value as { id?: unknown }).id;
  return { ...value, id: typeof maybeId === "string" ? maybeId : randomUUID() };
}

function mergeCharacterProfileEntries(entries: WorldbookDraftEntry[]): WorldbookDraftEntry[] {
  const merged: WorldbookDraftEntry[] = [];
  const characterIndexes = new Map<string, number>();

  for (const entry of entries) {
    if (entry.entryType !== "character_basic" && entry.entryType !== "character_personality") {
      merged.push(entry);
      continue;
    }

    const characterName = inferCharacterName(entry);
    const key = characterName.toLocaleLowerCase();
    const existingIndex = characterIndexes.get(key);
    if (existingIndex === undefined) {
      characterIndexes.set(key, merged.length);
      merged.push({ ...entry, comment: characterName, keys: uniqueStrings([characterName, ...entry.keys]) });
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      comment: characterName,
      entryType: "character_basic",
      keys: uniqueStrings([...existing.keys, ...entry.keys, characterName]),
      secondaryKeys: uniqueStrings([...(existing.secondaryKeys ?? []), ...(entry.secondaryKeys ?? [])]),
      content: mergeCharacterContent(existing.content, entry.content),
      constant: existing.constant || entry.constant,
      enabled: existing.enabled && entry.enabled,
      order: Math.min(existing.order, entry.order),
      position: existing.entryType === "character_basic" ? existing.position : entry.position,
      depth: existing.depth ?? entry.depth,
      scanDepth: existing.scanDepth ?? entry.scanDepth,
    };
  }

  return merged;
}

function inferCharacterName(entry: WorldbookDraftEntry): string {
  if (entry.characterName?.trim()) return entry.characterName.trim();
  const nameMatch = entry.content.match(/^\s*name\s*[:：]\s*([^\n\r]+)/m);
  if (nameMatch?.[1]) return nameMatch[1].trim();
  return entry.comment.replace(/[_＿-]?(基础设定|基本设定|性格设定|性格|basic|personality)$/i, "").trim() || entry.comment;
}

function mergeCharacterContent(first: string, second: string): string {
  const firstBlock = labelCharacterContent(first, "基础设定");
  const secondBlock = labelCharacterContent(second, "性格设定");
  if (!firstBlock.trim()) return secondBlock;
  if (!secondBlock.trim()) return firstBlock;
  if (firstBlock.includes(secondBlock)) return firstBlock;
  if (secondBlock.includes(firstBlock)) return secondBlock;
  return `${firstBlock.trim()}\n\n${secondBlock.trim()}`;
}

function labelCharacterContent(content: string, label: string): string {
  const trimmed = content.trim();
  if (!trimmed) return content;
  if (hasSingleXmlWrapper(trimmed) || /^【[^】]+】/.test(trimmed)) return trimmed;
  return `【${label}】\n${trimmed}`;
}

function hasSingleXmlWrapper(content: string): boolean {
  return /^<([a-zA-Z_][\w-]*)>[\s\S]*<\/\1>$/.test(content.trim());
}

export function draftEntriesToCharacterBookEntries(entries: WorldbookDraftEntry[]): CharacterBookEntry[] {
  return mergeCharacterProfileEntries(entries).map((entry, index) => ({
    id: index,
    keys: entry.keys,
    secondary_keys: entry.secondaryKeys ?? [],
    comment: entry.comment,
    content: entry.content,
    constant: entry.constant,
    selective: !entry.constant,
    insertion_order: entry.order,
    enabled: entry.enabled,
    position: entry.position,
    use_regex: true,
    extensions: {
      position: positionToNumber(entry.position),
      exclude_recursion: true,
      display_index: index,
      probability: 100,
      useProbability: true,
      depth: entry.position === "at_depth" ? entry.depth ?? 0 : entry.depth ?? 4,
      selectiveLogic: 0,
      outlet_name: "",
      group: "",
      group_override: false,
      group_weight: 100,
      prevent_recursion: true,
      delay_until_recursion: false,
      scan_depth: entry.scanDepth ?? (!entry.constant ? 2 : null),
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: "",
      role: entry.position === "at_depth" ? 0 : 0,
      vectorized: false,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      match_persona_description: false,
      match_character_description: false,
      match_character_personality: false,
      match_character_depth_prompt: false,
      match_scenario: false,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false,
    },
  }));
}
