import path from "node:path";
import { characterCardToProjectData } from "./character-card-importer.js";
import { extractThirdPartyAssetsFromCharacterCard } from "./third-party-asset-importer.js";
import { worldbookToDraft } from "./worldbook-importer.js";
import { SillyTavernWorldbookSchema } from "../schemas/sillytavern-worldbook.js";
import type { DraftSlice } from "../schemas/draft-slice.js";
import type { ProjectImportRecord } from "../schemas/project.js";
import { createDraftSlice, upsertDraftSlice } from "../storage/draft-store.js";
import { findRootTavernJsonFiles } from "../storage/workspace-store.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile } from "../utils/json.js";

export interface InitImportSummary {
  path: string;
  type: "worldbook" | "character_card";
  draft_slices: Array<{ type: DraftSlice["type"]; id: string; path: string }>;
  worldbook_entry_count: number;
  name?: string;
}

export async function importExistingTavernJsonFiles(): Promise<{ summaries: InitImportSummary[]; records: ProjectImportRecord[] }> {
  const files = await findRootTavernJsonFiles();
  const summaries: InitImportSummary[] = [];
  const records: ProjectImportRecord[] = [];
  for (const file of files) {
    const imported = await importTavernJsonFile(file);
    summaries.push(imported.summary);
    records.push(imported.record);
  }
  return { summaries, records };
}

async function importTavernJsonFile(filePath: string): Promise<{ summary: InitImportSummary; record: ProjectImportRecord }> {
  const raw = await readJsonFile(filePath);
  if (isCharacterCard(raw)) return importCharacterCard(filePath, raw as Record<string, unknown>);
  return importWorldbook(filePath, raw);
}

async function importWorldbook(filePath: string, raw: unknown): Promise<{ summary: InitImportSummary; record: ProjectImportRecord }> {
  const book = SillyTavernWorldbookSchema.parse(raw);
  const draft = worldbookToDraft(book);
  const written: InitImportSummary["draft_slices"] = [];
  for (const entry of draft) {
    const id = uniqueImportedId(filePath, entry.comment);
    const { path: slicePath } = await upsertDraftSlice(createDraftSlice({ type: "worldbook_entry", id, title: entry.comment, data: entry }));
    written.push({ type: "worldbook_entry", id, path: slicePath });
  }
  return {
    summary: { path: filePath, type: "worldbook", draft_slices: written, worldbook_entry_count: draft.length, name: book.name },
    record: { path: filePath, type: "worldbook", importedAt: nowIso(), worldbookEntryCount: draft.length },
  };
}

async function importCharacterCard(filePath: string, raw: Record<string, unknown>): Promise<{ summary: InitImportSummary; record: ProjectImportRecord }> {
  const { config, draft } = characterCardToProjectData(raw);
  const written: InitImportSummary["draft_slices"] = [];
  const profileId = uniqueImportedId(filePath, "profile");
  const greetingsId = uniqueImportedId(filePath, "greetings");
  const { path: profilePath } = await upsertDraftSlice(createDraftSlice({
    type: "character_profile",
    id: profileId,
    title: `${config.card.name} profile`,
    data: { ...config.card, include_worldbook: config.worldbook.source === "project_draft", worldbook_name: config.worldbook.name },
  }));
  written.push({ type: "character_profile", id: profileId, path: profilePath });
  const { path: greetingsPath } = await upsertDraftSlice(createDraftSlice({
    type: "character_greetings",
    id: greetingsId,
    title: `${config.card.name} greetings`,
    data: { first_mes: config.card.first_mes, alternate_greetings: config.card.alternate_greetings },
  }));
  written.push({ type: "character_greetings", id: greetingsId, path: greetingsPath });
  const assets = extractThirdPartyAssetsFromCharacterCard({ card: raw, worldbookDraft: draft, idPrefix: uniqueImportedId(filePath, "assets") });
  for (const entry of assets.retainedWorldbookEntries) {
    const id = uniqueImportedId(filePath, entry.comment);
    const { path: slicePath } = await upsertDraftSlice(createDraftSlice({ type: "worldbook_entry", id, title: entry.comment, data: entry }));
    written.push({ type: "worldbook_entry", id, path: slicePath });
  }
  for (const slice of assets.draftSlices) {
    const { path: slicePath } = await upsertDraftSlice(slice);
    written.push({ type: slice.type, id: slice.id, path: slicePath });
  }
  return {
    summary: {
      path: filePath,
      type: "character_card",
      draft_slices: written,
      worldbook_entry_count: assets.retainedWorldbookEntries.length,
      name: config.card.name,
      ...assets.summary,
    },
    record: { path: filePath, type: "character_card", importedAt: nowIso(), worldbookEntryCount: assets.retainedWorldbookEntries.length, hasMvu: assets.summary.detected_mvu, hasHtml: assets.summary.detected_html, hasEjs: assets.summary.detected_ejs },
  };
}

function isCharacterCard(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).spec === "chara_card_v3");
}

function uniqueImportedId(filePath: string, seed: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return `${base}-${seed}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}
