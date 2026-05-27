import type { EjsEntryConfig } from "../schemas/ejs.js";
import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import type { MvuConfig } from "../schemas/mvu.js";
import type { RegexSliceData } from "../schemas/regex.js";
import type { CreateWorldbookDraftTemplateInput, WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { defaultOrderForEntryType } from "./worldbook-entry-defaults.js";
import { uniqueStrings } from "../utils/strings.js";

export function createEntryTemplate(input: CreateWorldbookDraftTemplateInput): WorldbookDraftEntry {
  const comment = input.comment.trim();
  const entryType = input.entryType ?? input.entry_type ?? "other";
  const characterName = input.characterName ?? input.character_name;
  const constant = input.constant ?? true;
  const scanDepth = input.scanDepth ?? input.scan_depth ?? (!constant ? 2 : undefined);
  return { comment, entryType, keys: uniqueStrings([characterName?.trim() || comment]), secondaryKeys: [], content: "", ...(characterName?.trim() ? { characterName: characterName.trim() } : {}), constant, position: input.position ?? "before_char", order: input.order ?? defaultOrderForEntryType(entryType), enabled: input.enabled ?? true, ...(scanDepth === null || scanDepth === undefined ? {} : { scanDepth }), preventRecursion: true, excludeRecursion: true };
}

export function createMvuTemplate(): MvuConfig { return { schemaScript: "", initvar: "", updateRules: "", variableListPath: "stat_data", hideRegex: true, beautifyRegex: true }; }
export function createHtmlTemplate(): HtmlBeautifyConfig { return { target: "statusbar", theme: "minimal", statusbar: { html: "", hideRegex: true }, regexPolicy: { generateHideRegex: true, generateStatusbarRegex: true }, variablePaths: [] }; }
export function createRegexTemplate(): RegexSliceData { return { order: 100, purpose: "standalone", scripts: [] }; }
export function createEjsTemplate(input: { id: string; title?: string; preset?: string }): EjsEntryConfig { const role = input.preset === "stage" ? "stage" : "inline"; return { name: input.title ?? input.id, role, content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: role === "stage" ? false : true, variablePaths: [], templateType: "custom" }; }
