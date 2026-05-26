import path from "node:path";
import { characterCardToProjectData } from "./character-card-importer.js";
import { extractThirdPartyAssetsFromCharacterCard } from "./third-party-asset-importer.js";
import { worldbookToDraft } from "./worldbook-importer.js";
import { SillyTavernWorldbookSchema } from "../schemas/sillytavern-worldbook.js";
import type { DraftSlice } from "../schemas/draft-slice.js";
import type { RegexScriptAsset } from "./mvu-assets.js";
import type { ProjectImportRecord, ProjectProfile, ProjectGreetings } from "../schemas/project.js";
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

export interface InitProjectMetadataPatch {
  profile?: ProjectProfile;
  greetings?: ProjectGreetings;
  extraRegexScripts?: RegexScriptAsset[];
}

export async function importExistingTavernJsonFiles(slug: string): Promise<{ summaries: InitImportSummary[]; records: ProjectImportRecord[]; projectPatch: InitProjectMetadataPatch }> {
  const files = await findRootTavernJsonFiles();
  const summaries: InitImportSummary[] = [];
  const records: ProjectImportRecord[] = [];
  const projectPatch: InitProjectMetadataPatch = {};
  for (const file of files) {
    const imported = await importTavernJsonFile(slug, file);
    summaries.push(imported.summary);
    records.push(imported.record);
    if (imported.projectPatch?.profile && !projectPatch.profile) projectPatch.profile = imported.projectPatch.profile;
    if (imported.projectPatch?.greetings && !projectPatch.greetings) projectPatch.greetings = imported.projectPatch.greetings;
    if (imported.projectPatch?.extraRegexScripts?.length) projectPatch.extraRegexScripts = [...(projectPatch.extraRegexScripts ?? []), ...imported.projectPatch.extraRegexScripts];
  }
  return { summaries, records, projectPatch };
}

async function importTavernJsonFile(slug: string, filePath: string): Promise<{ summary: InitImportSummary; record: ProjectImportRecord; projectPatch?: InitProjectMetadataPatch }> {
  const raw = await readJsonFile(filePath);
  if (isCharacterCard(raw)) return importCharacterCard(slug, filePath, raw as Record<string, unknown>);
  return importWorldbook(slug, filePath, raw);
}

async function importWorldbook(slug: string, filePath: string, raw: unknown): Promise<{ summary: InitImportSummary; record: ProjectImportRecord }> {
  const book = SillyTavernWorldbookSchema.parse(raw);
  const draft = worldbookToDraft(book);
  const written: InitImportSummary["draft_slices"] = [];
  for (const [index, entry] of draft.entries()) {
    const id = uniqueImportedId(filePath, `${index}-${entry.comment}`);
    const { path: slicePath } = await upsertDraftSlice(slug, createDraftSlice({ type: "entry", id, title: entry.comment, data: entry }));
    written.push({ type: "entry", id, path: slicePath });
  }
  return {
    summary: { path: filePath, type: "worldbook", draft_slices: written, worldbook_entry_count: draft.length, name: book.name },
    record: { path: filePath, type: "worldbook", importedAt: nowIso(), worldbookEntryCount: draft.length },
  };
}

async function importCharacterCard(slug: string, filePath: string, raw: Record<string, unknown>): Promise<{ summary: InitImportSummary; record: ProjectImportRecord; projectPatch: InitProjectMetadataPatch }> {
  const { config, draft } = characterCardToProjectData(raw);
  const written: InitImportSummary["draft_slices"] = [];
  const profile: ProjectProfile = { ...config.card, include_worldbook: config.worldbook.source === "project_draft", worldbook_name: config.worldbook.name };
  const greetings: ProjectGreetings = { first_mes: config.card.first_mes, alternate_greetings: config.card.alternate_greetings };
  const assets = extractThirdPartyAssetsFromCharacterCard({ card: raw, worldbookDraft: draft, idPrefix: uniqueImportedId(filePath, "assets") });
  for (const [index, entry] of assets.retainedWorldbookEntries.entries()) {
    const id = uniqueImportedId(filePath, `${index}-${entry.comment}`);
    const { path: slicePath } = await upsertDraftSlice(slug, createDraftSlice({ type: "entry", id, title: entry.comment, data: entry }));
    written.push({ type: "entry", id, path: slicePath });
  }
  for (const slice of assets.draftSlices) {
    const { path: slicePath } = await upsertDraftSlice(slug, slice);
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
    projectPatch: { profile, greetings, extraRegexScripts: assets.extraRegexScripts },
  };
}

function isCharacterCard(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && (raw as Record<string, unknown>).spec === "chara_card_v3");
}

function uniqueImportedId(filePath: string, seed: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return `${base}-${seed}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}
