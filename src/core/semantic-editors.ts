import type { DraftSlice } from "../schemas/draft-slice.js";
import { DraftSliceSchema, DraftSliceDataSchemas } from "../schemas/draft-slice.js";
import { EjsEntryConfigSchema, type EjsEntryConfig } from "../schemas/ejs.js";
import { HtmlBeautifyConfigSchema, type HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import { MvuConfigSchema, type MvuConfig } from "../schemas/mvu.js";
import { RegexSliceDataSchema, type RegexScriptDraft, type RegexSliceData } from "../schemas/regex.js";
import { WorldbookDraftEntrySchema, type WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { normalizeWorldbookEntryContent } from "../utils/yaml-xml.js";
import { uniqueStrings } from "../utils/strings.js";
import { mvuEntryKeyFromId, normalizeMvuEntryContent } from "./mvu-entry-templates.js";
import { normalizeStatusbarHtml } from "./statusbar-html-normalizer.js";

export function updateEntryContent(slice: DraftSlice, content: string): DraftSlice {
  assertType(slice, "entry");
  const mvuKey = mvuEntryKeyFromId(slice.id);
  const normalized = mvuKey ? normalizeMvuEntryContent(mvuKey, content) : normalizeWorldbookEntryContent(content);
  const data = WorldbookDraftEntrySchema.parse({ ...(slice.data as object), content: normalized });
  return parseSlice({ ...slice, data });
}

export function updateEntryConfig(slice: DraftSlice, changes: Partial<Omit<WorldbookDraftEntry, "content">>): DraftSlice {
  assertType(slice, "entry");
  const current = WorldbookDraftEntrySchema.parse(slice.data);
  const next: Record<string, unknown> = { ...current, ...changes };
  if (typeof next.characterName === "string") next.characterName = next.characterName.trim();
  if (changes.characterName === null || next.characterName === "") delete next.characterName;
  if (changes.depth === null) delete next.depth;
  if (changes.scanDepth === null) delete next.scanDepth;
  if (Array.isArray(next.keys)) next.keys = uniqueStrings(next.keys.map(String));
  if (Array.isArray(next.secondaryKeys)) next.secondaryKeys = uniqueStrings(next.secondaryKeys.map(String));
  return parseSlice({ ...slice, data: WorldbookDraftEntrySchema.parse(next) });
}

export function updateSliceMetadata(slice: DraftSlice, changes: { title?: string; active?: boolean; tags?: string[]; notes?: string | null }): DraftSlice {
  const next = { ...slice, ...changes };
  if (changes.notes === null) delete (next as { notes?: string }).notes;
  return DraftSliceSchema.parse(next);
}

export function updateHtmlStatusbar(slice: DraftSlice, input: { html?: string; scopedCss?: string | null; variablePaths?: string[] }): DraftSlice {
  assertType(slice, "html");
  const data = HtmlBeautifyConfigSchema.parse(slice.data);
  const next: HtmlBeautifyConfig = { ...data, statusbar: { ...data.statusbar, ...(input.html !== undefined ? { html: normalizeStatusbarHtml(input.html) } : {}), ...(input.scopedCss === null ? { scopedCss: undefined } : input.scopedCss !== undefined ? { scopedCss: input.scopedCss } : {}) }, ...(input.variablePaths ? { variablePaths: uniqueStrings(input.variablePaths) } : {}) };
  return parseSlice({ ...slice, data: HtmlBeautifyConfigSchema.parse(next) });
}

export function updateHtmlConfig(slice: DraftSlice, changes: { target?: HtmlBeautifyConfig["target"]; theme?: HtmlBeautifyConfig["theme"]; hideRegex?: boolean; regexPolicy?: Partial<HtmlBeautifyConfig["regexPolicy"]> }): DraftSlice {
  assertType(slice, "html");
  const data = HtmlBeautifyConfigSchema.parse(slice.data);
  const next: HtmlBeautifyConfig = { ...data, ...(changes.target ? { target: changes.target } : {}), ...(changes.theme ? { theme: changes.theme } : {}), statusbar: { ...data.statusbar, ...(changes.hideRegex !== undefined ? { hideRegex: changes.hideRegex } : {}) }, regexPolicy: { ...data.regexPolicy, ...(changes.regexPolicy ?? {}) } };
  return parseSlice({ ...slice, data: HtmlBeautifyConfigSchema.parse(next) });
}

export function updateEjsContent(slice: DraftSlice, input: { content: string; variablePaths?: string[] }): DraftSlice {
  assertType(slice, "ejs");
  const data = EjsEntryConfigSchema.parse(slice.data);
  const next: EjsEntryConfig = { ...data, content: input.content, ...(input.variablePaths ? { variablePaths: uniqueStrings(input.variablePaths) } : {}) };
  return parseSlice({ ...slice, data: EjsEntryConfigSchema.parse(next) });
}

export function updateEjsConfig(slice: DraftSlice, changes: Partial<Omit<EjsEntryConfig, "content"> & { depth: number | null; scanDepth: number | null }>): DraftSlice {
  assertType(slice, "ejs");
  const data = EjsEntryConfigSchema.parse(slice.data);
  const next: Record<string, unknown> = { ...data, ...changes };
  if (changes.role === "stage" && changes.enabled === undefined) next.enabled = false;
  if (changes.role && changes.role !== "controller" && changes.stages !== undefined) throw new Error("非 controller EJS 不允许设置 stages");
  if (changes.depth === null) delete next.depth;
  if (changes.scanDepth === null) delete next.scanDepth;
  if (Array.isArray(next.keys)) next.keys = uniqueStrings(next.keys.map(String));
  if (Array.isArray(next.variablePaths)) next.variablePaths = uniqueStrings(next.variablePaths.map(String));
  return parseSlice({ ...slice, data: EjsEntryConfigSchema.parse(next) });
}

export function updateMvuSource(slice: DraftSlice, changes: Partial<MvuConfig>): DraftSlice {
  assertType(slice, "mvu");
  const data = MvuConfigSchema.parse(slice.data);
  const next: Record<string, unknown> = { ...data, ...changes };
  return parseSlice({ ...slice, data: MvuConfigSchema.parse(next) });
}

export function upsertRegexScript(slice: DraftSlice, script: RegexScriptDraft, ifExists: "error" | "overwrite" | "merge" = "error"): DraftSlice {
  assertType(slice, "regex");
  const data = RegexSliceDataSchema.parse(slice.data);
  const existing = data.scripts.findIndex((item) => item.id === script.id);
  let scripts: RegexScriptDraft[];
  if (existing >= 0 && ifExists === "error") throw new Error(`regex script ${script.id} 已存在`);
  if (existing >= 0 && ifExists === "merge") scripts = data.scripts.map((item, index) => index === existing ? { ...item, ...script } : item);
  else if (existing >= 0) scripts = data.scripts.map((item, index) => index === existing ? script : item);
  else scripts = [...data.scripts, script];
  return regexSliceWithScripts(slice, data, scripts);
}

export function updateRegexScript(slice: DraftSlice, scriptId: string, changes: Partial<Omit<RegexScriptDraft, "id" | "source" | "origin">>): DraftSlice {
  assertType(slice, "regex");
  const data = RegexSliceDataSchema.parse(slice.data);
  const scripts = data.scripts.map((script) => script.id === scriptId ? { ...script, ...changes, id: script.id, source: script.source, origin: script.origin } : script);
  if (!data.scripts.some((script) => script.id === scriptId)) throw new Error(`未找到 regex script ${scriptId}`);
  return regexSliceWithScripts(slice, data, scripts);
}

export function removeRegexScript(slice: DraftSlice, scriptId: string, deactivateEmptySlice = true): DraftSlice {
  assertType(slice, "regex");
  const data = RegexSliceDataSchema.parse(slice.data);
  const scripts = data.scripts.filter((script) => script.id !== scriptId);
  const next = regexSliceWithScripts(slice, data, scripts);
  return deactivateEmptySlice && scripts.length === 0 ? DraftSliceSchema.parse({ ...next, active: false }) : next;
}

export function reorderRegexScripts(slice: DraftSlice, scriptOrder: string[]): DraftSlice {
  assertType(slice, "regex");
  const data = RegexSliceDataSchema.parse(slice.data);
  const order = new Map(scriptOrder.map((id, index) => [id, index]));
  const scripts = data.scripts.map((script, index) => ({ ...script, order: order.has(script.id) ? order.get(script.id)! : scriptOrder.length + index })).sort((a, b) => a.order - b.order);
  return regexSliceWithScripts(slice, data, scripts);
}

export function moveRegexScript(from: DraftSlice, to: DraftSlice, scriptId: string, options: { newScriptId?: string; newOrder?: number } = {}): { from: DraftSlice; to: DraftSlice } {
  assertType(from, "regex");
  assertType(to, "regex");
  const fromData = RegexSliceDataSchema.parse(from.data);
  const toData = RegexSliceDataSchema.parse(to.data);
  const script = fromData.scripts.find((item) => item.id === scriptId);
  if (!script) throw new Error(`未找到 regex script ${scriptId}`);
  const moved = { ...script, id: options.newScriptId ?? script.id, ...(options.newOrder !== undefined ? { order: options.newOrder } : {}) };
  return { from: regexSliceWithScripts(from, fromData, fromData.scripts.filter((item) => item.id !== scriptId)), to: regexSliceWithScripts(to, toData, [...toData.scripts, moved]) };
}

function regexSliceWithScripts(slice: DraftSlice, data: RegexSliceData, scripts: RegexScriptDraft[]): DraftSlice { return parseSlice({ ...slice, data: RegexSliceDataSchema.parse({ ...data, scripts }) }); }
function assertType<T extends DraftSlice["type"]>(slice: DraftSlice, type: T): asserts slice is DraftSlice & { type: T } { if (slice.type !== type) throw new Error(`需要 ${type} slice，实际是 ${slice.type}`); }
function parseSlice(slice: DraftSlice): DraftSlice { return DraftSliceSchema.parse({ ...slice, data: DraftSliceDataSchemas[slice.type].parse(slice.data) }); }
