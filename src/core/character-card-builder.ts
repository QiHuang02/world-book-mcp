import { randomUUID } from "node:crypto";
import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { HtmlBeautifyAssets } from "./html-beautify-assets.js";
import type { MvuAssets } from "./mvu-assets.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
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

export function draftEntriesToCharacterBookEntries(entries: WorldbookDraftEntry[]): CharacterBookEntry[] {
  return entries.map((entry, index) => ({
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
