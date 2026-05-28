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

export function createMvuTemplate(): MvuConfig {
  return { schemaScript: "", variableListPath: "stat_data", hideRegex: true, beautifyRegex: true };
}

export function createHtmlTemplate(): HtmlBeautifyConfig {
  return {
    target: "statusbar",
    theme: "minimal",
    statusbar: {
      html: `<div class="wbm-statusbar">
  <div class="wbm-statusbar__title">状态</div>
  <div class="wbm-statusbar__line">{{format_message_variable::stat_data}}</div>
</div>`,
      hideRegex: true,
    },
    regexPolicy: { generateHideRegex: true, generateStatusbarRegex: true },
    variablePaths: [],
  };
}

export function createRegexTemplate(): RegexSliceData { return { order: 100, purpose: "standalone", scripts: [] }; }

export function createEjsTemplate(input: { id: string; title?: string; preset?: string }): EjsEntryConfig {
  const role = input.preset === "stage" ? "stage" : "inline";
  return {
    name: input.title ?? input.id,
    role,
    content: role === "stage" ? "阶段内容" : `<%_\nif (typeof value === 'undefined') var value = getvar('stat_data.角色A.好感度', { defaults: 0 });\n_%>\n<%_ if (value < 50) { _%>\n阶段一内容\n<%_ } else { _%>\n阶段二内容\n<%_ } _%>`,
    keys: [],
    constant: role !== "stage",
    position: "after_char",
    order: role === "stage" ? 98 : 100,
    enabled: role === "stage" ? false : true,
    variablePaths: role === "stage" ? [] : ["stat_data.角色A.好感度"],
    templateType: "custom",
  };
}
