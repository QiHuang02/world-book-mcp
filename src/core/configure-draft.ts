import path from "node:path";
import type { EntryTypeSchema } from "../schemas/draft.js";
import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference } from "../storage/path-policy.js";
import type { z } from "zod";

export type EntryType = z.infer<typeof EntryTypeSchema>;
export type ConfigureStrategy = "blue" | "green";
export type ConfigureProfile = "single_character" | "multi_character" | "worldbook";
export type ConfigureModeStrategy = "explicit" | "auto";
export interface ConfigureDraftEntryInput {
  id: string;
  comment: string;
  type?: EntryType;
  content: string;
  strategy?: ConfigureStrategy;
  keys?: string[];
  order?: number;
  part?: string;
  scope?: "catalog" | "specific";
  status?: "planned" | "drafted" | "reviewed" | "done";
  abstract?: string;
  sourceRefs?: string[];
  rephrase?: boolean;
}
export interface ConfigureDraftOptions {
  mode: "preview" | "apply";
  profile?: ConfigureProfile;
  strategy?: ConfigureModeStrategy;
  typeLists?: { before_char?: EntryType[]; after_char?: EntryType[]; depth?: EntryType[] };
  strategyThresholds?: Partial<Record<EntryType, number | "Infinity" | null>>;
  partOrder?: Record<string, number>;
  requiredParts?: string[];
  entries: ConfigureDraftEntryInput[];
}
export interface ConfigureDraftAction { code: string; message: string; entry_id?: string }
export interface ConfigureDraftResult { ok: boolean; project_id: string; mode: "preview" | "apply"; entries: unknown[]; actions: ConfigureDraftAction[] }

const DEFAULT_TYPE_LISTS: Required<NonNullable<ConfigureDraftOptions["typeLists"]>> = {
  before_char: ["world_summary", "background", "faction"],
  after_char: ["character_overview", "character_basic", "character_personality", "player", "npc", "item", "ability", "scene", "event", "dialogue", "other"],
  depth: ["style"],
};

const DEFAULT_PART_ORDER: Record<string, number> = {
  world_summary: 1,
  background: 2,
  character_overview: 4,
  character_basic: 10,
  character_personality: 30,
  player: 40,
  item: 50,
  ability: 60,
  faction: 70,
  scene: 80,
  event: 90,
  npc: 100,
  style: 110,
  dialogue: 120,
  other: 130,
  rephrase: 900,
};

export async function configureDraft(project: Project, options: ConfigureDraftOptions): Promise<ConfigureDraftResult> {
  const draft = await readDraft(project);
  const worldbook = draft.worldbook ?? { name: project.name, entries: [] };
  const actions: ConfigureDraftAction[] = [];
  assertUniqueEntryIds(options.entries.map((entry) => entry.id), "输入 entries 内部存在重复 id");
  const existingIds = new Set(worldbook.entries.map((entry) => entry.id));
  for (const entry of options.entries) if (existingIds.has(entry.id)) throw new Error(`世界书条目 id 已存在: ${entry.id}`);
  for (const entry of options.entries) assertEntryContentReference(project, entry.content, entry.id);

  const existingParts = new Set(worldbook.entries.map((entry) => entry.part).filter(Boolean) as string[]);
  const inputParts = new Set(options.entries.map((entry) => entry.part).filter(Boolean) as string[]);
  for (const part of options.requiredParts ?? []) {
    if (!existingParts.has(part) && !inputParts.has(part)) actions.push({ code: "configure.required_part_missing", message: `required part 未覆盖: ${part}` });
  }

  const groupCounters = new Map<string, number>();
  const usedOrders = new Set(worldbook.entries.map((entry) => entry.order));
  const plannedContext: Array<{ type?: EntryType; part?: string; scope?: string; rephrase?: boolean }> = [...worldbook.entries];
  const configured = options.entries.map((entry) => {
    const type = entry.type ?? "other";
    const effectiveStrategy = resolveStrategy(entry, type, options, plannedContext);
    const isGreen = effectiveStrategy === "green";
    const keys = entry.keys ?? [];
    const nextKeys = isGreen && keys.length === 0 ? [entry.comment] : keys;
    if (isGreen && keys.length === 0) actions.push({ code: "configure.keys.defaulted", message: "绿灯条目未提供 keys，已使用 comment 作为默认 keys", entry_id: entry.id });
    const position = inferPosition(type, options.typeLists, Boolean(entry.rephrase));
    const depth = entry.rephrase ? 0 : position === "at_depth" ? 0 : 4;
    const order = entry.order ?? nextGroupedOrder(type, entry, options.partOrder, groupCounters, usedOrders);
    usedOrders.add(order);
    const configuredEntry = {
      id: entry.id,
      comment: entry.comment,
      type,
      content: entry.content,
      enabled: true,
      constant: !isGreen,
      keys: nextKeys,
      secondary_keys: [],
      position,
      order,
      depth,
      scanDepth: isGreen ? 2 : null,
      preventRecursion: true,
      excludeRecursion: true,
      part: entry.part,
      scope: entry.scope,
      status: entry.status ?? "planned",
      abstract: entry.abstract,
      sourceRefs: entry.sourceRefs ?? [],
      rephrase: Boolean(entry.rephrase),
    };
    plannedContext.push(configuredEntry);
    return configuredEntry;
  });

  if (options.mode === "apply") {
    await writeDraft(project, "worldbook", { ...worldbook, entries: [...worldbook.entries, ...configured] });
    actions.push({ code: "configure.applied", message: `已追加 ${configured.length} 个世界书条目` });
  }
  return { ok: true, project_id: project.id, mode: options.mode, entries: configured, actions };
}

function resolveStrategy(entry: ConfigureDraftEntryInput, type: EntryType, options: ConfigureDraftOptions, plannedEntries: Array<{ type?: EntryType; part?: string; scope?: string; rephrase?: boolean }>): ConfigureStrategy {
  if (entry.scope === "catalog") return "blue";
  if (entry.rephrase) return "green";
  if ((options.strategy ?? "explicit") === "explicit") return entry.strategy ?? "blue";
  const threshold = options.strategyThresholds?.[type];
  if (threshold === null) return "blue";
  if (threshold === "Infinity") return "blue";
  if (typeof threshold === "number") {
    if (threshold <= 0) return "green";
    const sameGroupCount = plannedEntries.filter((item) => (item.part ?? item.type ?? "other") === (entry.part ?? type) && item.scope !== "catalog").length;
    return sameGroupCount >= threshold ? "green" : "blue";
  }
  const profile = options.profile ?? "single_character";
  if (profile === "worldbook") return "blue";
  if (profile === "single_character" && (type === "character_basic" || type === "character_personality" || type === "character_overview")) return "blue";
  if (profile === "multi_character" && (type === "character_personality" || type === "character_basic" || type === "npc")) return "green";
  return entry.strategy ?? "blue";
}

function nextGroupedOrder(type: EntryType, entry: ConfigureDraftEntryInput, partOrder: Record<string, number> | undefined, counters: Map<string, number>, usedOrders: Set<number>): number {
  const group = entry.rephrase ? "rephrase" : entry.part ?? type;
  const base = partOrder?.[group] ?? partOrder?.[type] ?? DEFAULT_PART_ORDER[group] ?? DEFAULT_PART_ORDER[type] ?? DEFAULT_PART_ORDER.other;
  let index = counters.get(group) ?? 0;
  let order = base * 10 + index;
  while (usedOrders.has(order)) {
    index += 1;
    order = base * 10 + index;
  }
  counters.set(group, index + 1);
  return order;
}

function assertUniqueEntryIds(ids: string[], message: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${message}: ${id}`);
    seen.add(id);
  }
}

function assertEntryContentReference(project: Project, reference: string, entryId: string): void {
  const resolved = resolveDraftReference(projectDir(project.slug), draftPath(project, "worldbook"), reference);
  const expectedRoot = path.resolve(projectDir(project.slug), project.paths.sourceRoot, "entries");
  const relative = path.relative(expectedRoot, resolved);
  if (!reference.includes("/") || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`configure_draft entry ${entryId} content 必须引用 source/entries/ 下文件`);
}

function inferPosition(type: EntryType, typeLists: ConfigureDraftOptions["typeLists"], rephrase: boolean): "before_char" | "after_char" | "before_an" | "after_an" | "at_depth" | "before_em" | "after_em" | "outlet" {
  if (rephrase) return "at_depth";
  const lists = { before_char: typeLists?.before_char ?? DEFAULT_TYPE_LISTS.before_char, after_char: typeLists?.after_char ?? DEFAULT_TYPE_LISTS.after_char, depth: typeLists?.depth ?? DEFAULT_TYPE_LISTS.depth };
  if (lists.before_char.includes(type)) return "before_char";
  if (lists.after_char.includes(type)) return "after_char";
  if (lists.depth.includes(type)) return "at_depth";
  if (type === "style") return "before_an";
  if (type === "dialogue") return "after_an";
  return "after_char";
}
