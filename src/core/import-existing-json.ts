import fs from "node:fs/promises";
import path from "node:path";
import { characterCardToProjectData } from "./character-card-importer.js";
import { worldbookToDraft } from "./worldbook-importer.js";
import { SillyTavernWorldbookSchema } from "../schemas/sillytavern-worldbook.js";
import type { Project, ProjectImportRecord } from "../schemas/project.js";
import type { DraftSlice } from "../schemas/draft-slice.js";
import type { RegexScriptDraft } from "../schemas/regex.js";
import { createDraftSlice, upsertDraftSlice } from "../storage/draft-store.js";
import { findRootTavernJsonFiles } from "../storage/workspace-store.js";
import { nowIso } from "../utils/ids.js";
import { readJsonFile } from "../utils/json.js";
import { sha256Buffer } from "../storage/build-store.js";

export interface ImportExistingJsonOptions {
  path?: string;
  include?: { entries?: boolean; character_profile?: boolean; greetings?: boolean; mvu?: boolean; html?: boolean; regex?: boolean; ejs?: boolean };
  if_exists?: "error" | "overwrite" | "rename";
  set_as_import_target?: boolean;
}

export interface ImportExistingJsonResult {
  project: Project;
  importRecord?: ProjectImportRecord;
  created_slices: Array<{ type: DraftSlice["type"]; id: string; path: string; origin_pointer?: string }>;
  candidates?: Array<{ path: string; type: "worldbook" | "character_card"; name?: string }>;
  summary?: ProjectImportRecord["summary"];
  warnings: string[];
}

export async function scanImportCandidates(): Promise<Array<{ path: string; type: "worldbook" | "character_card"; name?: string }>> {
  const files = await findRootTavernJsonFiles();
  const result: Array<{ path: string; type: "worldbook" | "character_card"; name?: string }> = [];
  for (const file of files) {
    const raw = await readJsonFile(file) as Record<string, unknown>;
    result.push({ path: file, type: isCharacterCard(raw) ? "character_card" : "worldbook", name: inferName(raw) });
  }
  return result;
}

export async function importExistingJson(project: Project, slug: string, options: ImportExistingJsonOptions = {}): Promise<ImportExistingJsonResult> {
  const warnings: string[] = [];
  let targetPath = options.path;
  if (!targetPath) {
    const candidates = await scanImportCandidates();
    if (candidates.length === 0) throw new Error("未找到可导入的 SillyTavern JSON");
    if (candidates.length > 1) return { project, candidates, created_slices: [], warnings: ["发现多个候选 JSON，请调用 import_existing_json(path=...) 选择一个"] };
    targetPath = candidates[0].path;
  }
  const rawBuffer = await fs.readFile(targetPath);
  const raw = JSON.parse(rawBuffer.toString("utf8")) as Record<string, unknown>;
  const importId = `import_${Date.now().toString(36)}`;
  const importedAt = nowIso();
  const type = isCharacterCard(raw) ? "character_card" : "worldbook";
  const include = { entries: true, character_profile: true, greetings: true, mvu: true, html: true, regex: true, ejs: true, ...(options.include ?? {}) };
  const created_slices: ImportExistingJsonResult["created_slices"] = [];
  let nextProject = project;
  let entryCount = 0;
  let regexScriptCount = 0;
  let hasProfile = false;
  let hasGreetings = false;
  let hasMvu = false;
  let hasHtml = false;
  let hasRegex = false;
  let hasEjs = false;

  if (type === "worldbook") {
    const draft = worldbookToDraft(SillyTavernWorldbookSchema.parse(raw));
    if (include.entries) {
      for (const [index, entry] of draft.entries()) {
        const id = uniqueImportedId(targetPath, `${entry.sourceUid ?? index}-${entry.comment}`);
        const slice = createDraftSlice({ type: "entry", id, title: entry.comment, source: "imported", origin: { kind: "imported", importId, sourcePath: targetPath, sourceFormat: "worldbook", importedAt, pointer: `/entries/${entry.sourceUid ?? index}`, uid: entry.sourceUid, entryIndex: index }, data: entry });
        const written = await upsertDraftSlice(slug, slice);
        created_slices.push({ type: "entry", id, path: written.path, origin_pointer: slice.origin?.kind === "imported" ? slice.origin.pointer : undefined });
      }
      entryCount = draft.length;
    }
  } else {
    const imported = characterCardToProjectData(raw);
    if (include.character_profile) {
      nextProject = { ...nextProject, profile: { ...imported.config.card, include_worldbook: imported.config.worldbook.source === "project_draft", worldbook_name: imported.config.worldbook.name } };
      hasProfile = true;
    }
    if (include.greetings) {
      nextProject = { ...nextProject, greetings: { first_mes: imported.config.card.first_mes, alternate_greetings: imported.config.card.alternate_greetings } };
      hasGreetings = true;
    }
    if (include.entries) {
      for (const [index, entry] of imported.draft.entries()) {
        const id = uniqueImportedId(targetPath, `${index}-${entry.comment}`);
        const slice = createDraftSlice({ type: "entry", id, title: entry.comment, source: "imported", origin: { kind: "imported", importId, sourcePath: targetPath, sourceFormat: "character_card", importedAt, pointer: `/data/character_book/entries/${index}`, entryIndex: index }, data: entry });
        const written = await upsertDraftSlice(slug, slice);
        created_slices.push({ type: "entry", id, path: written.path, origin_pointer: slice.origin?.kind === "imported" ? slice.origin.pointer : undefined });
      }
      entryCount = imported.draft.length;
    }
    if (include.regex) {
      const scripts = extractRegexScripts(raw).map((script, index): RegexScriptDraft => ({ id: uniqueImportedId(targetPath, `regex-${index}-${script.scriptName}`), scriptName: script.scriptName, order: index, findRegex: script.findRegex, replaceString: script.replaceString, trimStrings: script.trimStrings, placement: script.placement, disabled: script.disabled, markdownOnly: script.markdownOnly, promptOnly: script.promptOnly, runOnEdit: script.runOnEdit, substituteRegex: script.substituteRegex, minDepth: script.minDepth, maxDepth: script.maxDepth, source: "third_party", origin: { sourcePath: targetPath, scriptName: script.scriptName, index } }));
      if (scripts.length > 0) {
        const id = uniqueImportedId(targetPath, "third-party-regex");
        const slice = createDraftSlice({ type: "regex", id, title: "导入第三方正则", source: "imported", origin: { kind: "imported", importId, sourcePath: targetPath, sourceFormat: "character_card", importedAt, pointer: "/data/extensions/regex_scripts", regexSource: "third_party" }, data: { order: 200, purpose: "third_party", scripts } });
        const written = await upsertDraftSlice(slug, slice);
        created_slices.push({ type: "regex", id, path: written.path, origin_pointer: "/data/extensions/regex_scripts" });
        regexScriptCount = scripts.length;
        hasRegex = true;
      }
    }
  }
  const summary = { entryCount, regexScriptCount, hasCharacterProfile: hasProfile, hasGreetings, hasMvu, hasHtml, hasRegex, hasEjs };
  const record: ProjectImportRecord = { importId, path: targetPath, type, importedAt, sourceHash: sha256Buffer(rawBuffer), sourceBytes: rawBuffer.length, summary, exportTarget: options.set_as_import_target === false ? undefined : type === "worldbook" ? { worldbookPath: targetPath } : { characterCardPath: targetPath } };
  nextProject = { ...nextProject, imports: [...nextProject.imports, record], kind: { ...nextProject.kind, assets: { ...nextProject.kind.assets, regex: { ...nextProject.kind.assets.regex, enabled: nextProject.kind.assets.regex.enabled || hasRegex, imported: nextProject.kind.assets.regex.imported || hasRegex, slice_count: nextProject.kind.assets.regex.slice_count + (hasRegex ? 1 : 0), sources: hasRegex ? Array.from(new Set([...nextProject.kind.assets.regex.sources, "third_party" as const])) : nextProject.kind.assets.regex.sources } } } };
  return { project: nextProject, importRecord: record, created_slices, summary, warnings };
}

function isCharacterCard(raw: Record<string, unknown>): boolean { return raw.spec === "chara_card_v3"; }
function inferName(raw: Record<string, unknown>): string | undefined { return String(((raw.data as Record<string, unknown> | undefined)?.name ?? raw.name) ?? "") || undefined; }
function uniqueImportedId(filePath: string, seed: string): string { const base = path.basename(filePath, path.extname(filePath)); return `${base}-${seed}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_"); }

interface ImportedRegex { scriptName: string; findRegex: string; replaceString: string; trimStrings: string[]; placement: number[]; disabled: boolean; markdownOnly: boolean; promptOnly: boolean; runOnEdit: boolean; substituteRegex: number; minDepth: number | null; maxDepth: number | null }
function extractRegexScripts(card: Record<string, unknown>): ImportedRegex[] {
  const extensions = ((card.data as Record<string, unknown> | undefined)?.extensions ?? {}) as Record<string, unknown>;
  const scripts = Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : [];
  return scripts.map((script, index) => normalizeRegex(script as Record<string, unknown>, index));
}
function normalizeRegex(script: Record<string, unknown>, index: number): ImportedRegex { return { scriptName: String(script.scriptName ?? script.name ?? `导入正则 ${index + 1}`), findRegex: String(script.findRegex ?? ""), replaceString: String(script.replaceString ?? ""), trimStrings: Array.isArray(script.trimStrings) ? script.trimStrings.map(String) : [], placement: Array.isArray(script.placement) ? script.placement.map(Number) : [2], disabled: Boolean(script.disabled ?? false), markdownOnly: Boolean(script.markdownOnly ?? true), promptOnly: Boolean(script.promptOnly ?? false), runOnEdit: Boolean(script.runOnEdit ?? false), substituteRegex: Number(script.substituteRegex ?? 0), minDepth: typeof script.minDepth === "number" ? script.minDepth : null, maxDepth: typeof script.maxDepth === "number" ? script.maxDepth : null }; }
