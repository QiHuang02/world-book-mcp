import type { DraftSlice } from "../schemas/draft-slice.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createDraftSlice } from "../storage/draft-store.js";
import { normalizeMvuYamlField } from "../utils/yaml-xml.js";
import type { RegexScriptAsset } from "./mvu-assets.js";
import { MVU_OUTPUT_FORMAT_TAG, MVU_UPDATE_RULES_TAG } from "./mvu-assets.js";

export interface ThirdPartyAssetExtractionResult {
  draftSlices: DraftSlice[];
  retainedWorldbookEntries: WorldbookDraftEntry[];
  extraRegexScripts: RegexScriptAsset[];
  summary: {
    detected_mvu: boolean;
    detected_html: boolean;
    detected_ejs: boolean;
    regex_count: number;
    tavern_helper_script_count: number;
    mvu_worldbook_entry_count: number;
    ejs_entry_count: number;
  };
}

export function extractThirdPartyAssetsFromCharacterCard(input: { card: Record<string, unknown>; worldbookDraft: WorldbookDraftEntry[]; idPrefix: string }): ThirdPartyAssetExtractionResult {
  const regexScripts = extractRegexScripts(input.card);
  const tavernScripts = extractTavernHelperScripts(input.card);
  const retained: WorldbookDraftEntry[] = [];
  const ejsEntries: WorldbookDraftEntry[] = [];
  const mvuEntries: WorldbookDraftEntry[] = [];
  const draftSlices: DraftSlice[] = [];

  let initvar = "";
  let updateRules = "";
  let outputFormat = "";
  let variableListPath: string | false = "stat_data";

  for (const entry of input.worldbookDraft) {
    if (isMvuEntry(entry)) {
      mvuEntries.push(entry);
      if (isInitvarEntry(entry)) initvar = unwrapInitvar(entry.content);
      // 注意：必须先匹配更具体的"变量输出格式/output"，否则形如 "[mvu_update]变量输出格式" 的 comment
      // 会被宽松的 "update" 关键词误判为更新规则。
      else if (/变量输出格式|output/i.test(entry.comment)) outputFormat = normalizeMvuYamlField(entry.content, [MVU_OUTPUT_FORMAT_TAG]);
      else if (/变量更新规则|update/i.test(entry.comment)) updateRules = normalizeMvuYamlField(entry.content, [MVU_UPDATE_RULES_TAG]);
      else if (/变量列表/.test(entry.comment) || /format_message_variable::/.test(entry.content)) variableListPath = extractVariableListPath(entry.content) ?? variableListPath;
      continue;
    }
    if (isEjsEntry(entry)) {
      ejsEntries.push(entry);
      continue;
    }
    retained.push(entry);
  }

  const schemaScript = findSchemaScript(tavernScripts) ?? "";
  const mvuRegexes = regexScripts.filter(isMvuRegex);
  const htmlRegexes = regexScripts.filter(isHtmlRegex);
  const thirdPartyRegexes = regexScripts.filter((script) => !isMvuRegex(script) && !isHtmlRegex(script));

  if (schemaScript || initvar || updateRules || outputFormat || mvuRegexes.length > 0 || mvuEntries.length > 0) {
    draftSlices.push(createDraftSlice({
      type: "mvu",
      id: "mvu",
      title: "导入 MVU 配置",
      data: { enabled: true, style: "zod", schema_script: schemaScript, initvar, update_rules: updateRules, output_format: outputFormat, variable_list_path: variableListPath, hide_regex: mvuRegexes.some((script) => script.promptOnly), beautify_regex: mvuRegexes.some((script) => !script.promptOnly) },
    }));
  }

  const statusbarDisplay = htmlRegexes.find((script) => !script.promptOnly && /<|wbm-statusbar|Status/i.test(script.replaceString));
  const statusbarHide = htmlRegexes.find((script) => script.promptOnly);
  if (statusbarDisplay || htmlRegexes.length > 0) {
    draftSlices.push(createDraftSlice({
      type: "html",
      id: "html",
      title: "导入 HTML 美化配置",
      data: {
        enabled: true,
        target: statusbarDisplay ? "statusbar" : "global",
        theme: "custom",
        statusbar: { enabled: Boolean(statusbarDisplay), html: statusbarDisplay?.replaceString ?? "", hide_regex: Boolean(statusbarHide) },
        global: { enabled: htmlRegexes.length > 0, regex_scripts: htmlRegexes.map((script) => regexToDraft(script)) },
      },
    }));
  }

  for (const [index, entry] of ejsEntries.entries()) {
    draftSlices.push(createDraftSlice({
      type: "ejs",
      id: `${input.idPrefix}-ejs-${index + 1}`,
      title: entry.comment,
      data: {
        name: entry.comment,
        role: inferEjsRole(entry),
        content: entry.content,
        keys: entry.keys,
        constant: entry.constant,
        position: entry.position,
        order: entry.order,
        enabled: entry.enabled,
        depth: entry.depth,
        scanDepth: entry.scanDepth,
        source: "imported",
        variable_paths: extractVariablePaths(entry.content),
        template_type: "custom",
      },
    }));
  }

  return {
    draftSlices,
    retainedWorldbookEntries: retained,
    extraRegexScripts: thirdPartyRegexes,
    summary: {
      detected_mvu: Boolean(schemaScript || initvar || updateRules || outputFormat || mvuRegexes.length || mvuEntries.length),
      detected_html: Boolean(statusbarDisplay || htmlRegexes.length),
      detected_ejs: ejsEntries.length > 0,
      regex_count: regexScripts.length,
      tavern_helper_script_count: tavernScripts.length,
      mvu_worldbook_entry_count: mvuEntries.length,
      ejs_entry_count: ejsEntries.length,
    },
  };
}

function extractRegexScripts(card: Record<string, unknown>): RegexScriptAsset[] {
  const extensions = ((card.data as Record<string, unknown> | undefined)?.extensions ?? {}) as Record<string, unknown>;
  const scripts = Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : [];
  return scripts.map((script, index) => normalizeRegex(script as Record<string, unknown>, index));
}

function extractTavernHelperScripts(card: Record<string, unknown>): Array<{ name: string; content: string }> {
  const extensions = ((card.data as Record<string, unknown> | undefined)?.extensions ?? {}) as Record<string, unknown>;
  const tavernHelper = extensions.tavern_helper;
  const scripts: Array<{ name: string; content: string }> = [];
  if (!Array.isArray(tavernHelper)) return scripts;
  for (const pair of tavernHelper) {
    if (!Array.isArray(pair) || pair[0] !== "scripts" || !Array.isArray(pair[1])) continue;
    for (const script of pair[1]) {
      if (!script || typeof script !== "object") continue;
      const record = script as Record<string, unknown>;
      scripts.push({ name: String(record.name ?? ""), content: String(record.content ?? "") });
    }
  }
  return scripts;
}

function normalizeRegex(script: Record<string, unknown>, index: number): RegexScriptAsset {
  return {
    scriptName: String(script.scriptName ?? script.name ?? `导入正则 ${index + 1}`),
    findRegex: String(script.findRegex ?? ""),
    replaceString: String(script.replaceString ?? ""),
    trimStrings: Array.isArray(script.trimStrings) ? script.trimStrings.map(String) : [],
    placement: Array.isArray(script.placement) ? script.placement.map(Number) : [2],
    disabled: Boolean(script.disabled ?? false),
    markdownOnly: Boolean(script.markdownOnly ?? true),
    promptOnly: Boolean(script.promptOnly ?? false),
    runOnEdit: Boolean(script.runOnEdit ?? false),
    substituteRegex: Number(script.substituteRegex ?? 0),
    minDepth: typeof script.minDepth === "number" ? script.minDepth : null,
    maxDepth: typeof script.maxDepth === "number" ? script.maxDepth : null,
  };
}

function isMvuEntry(entry: WorldbookDraftEntry): boolean {
  return /\[?initvar\]?|mvu_update|变量更新规则|变量输出格式|变量列表/i.test(entry.comment) || /<initvar>|<UpdateVariable>|format_message_variable::/.test(entry.content);
}

function isInitvarEntry(entry: WorldbookDraftEntry): boolean {
  return /initvar|变量初始化/i.test(entry.comment) || /<initvar>/.test(entry.content);
}

function isEjsEntry(entry: WorldbookDraftEntry): boolean {
  return /<%|%>|getwi\(|getvar\(|@preprocessing|@generate_before|@generate_after/.test(entry.content);
}

function isMvuRegex(script: RegexScriptAsset): boolean {
  return /UpdateVariable|updatevariable|变量更新/i.test(`${script.scriptName}\n${script.findRegex}\n${script.replaceString}`);
}

function isHtmlRegex(script: RegexScriptAsset): boolean {
  return /StatusPlaceHolderImpl|wbm-statusbar|状态栏|界面/i.test(`${script.scriptName}\n${script.findRegex}\n${script.replaceString}`);
}

function findSchemaScript(scripts: Array<{ name: string; content: string }>): string | undefined {
  return scripts.find((script) => /变量结构|schema/i.test(script.name) || /registerMvuSchema/.test(script.content))?.content;
}

function unwrapInitvar(content: string): string {
  return content.replace(/^\s*<initvar>\s*/i, "").replace(/\s*<\/initvar>\s*$/i, "").trim();
}

function extractVariableListPath(content: string): string | undefined {
  return content.match(/format_message_variable::([^}\s<]+)/)?.[1];
}

function regexToDraft(script: RegexScriptAsset) {
  return {
    name: script.scriptName,
    findRegex: script.findRegex,
    replaceString: script.replaceString,
    markdownOnly: script.markdownOnly,
    promptOnly: script.promptOnly,
    placement: script.placement,
    runOnEdit: script.runOnEdit,
  };
}

function inferEjsRole(entry: WorldbookDraftEntry): "controller" | "stage" | "inline" | "helper" {
  if (/stage|阶段/i.test(entry.comment)) return "stage";
  if (/getwi\(/.test(entry.content) && entry.constant) return "controller";
  return "inline";
}

function extractVariablePaths(content: string): string[] {
  return Array.from(new Set([...content.matchAll(/stat_data(?:\.[\w\u4e00-\u9fa5-]+)+/g)].map((match) => match[0])));
}
