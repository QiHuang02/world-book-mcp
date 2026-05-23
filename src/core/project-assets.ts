import type { Project } from "../schemas/project.js";
import type { RegexScriptAsset, TavernHelperScriptAsset } from "./mvu-assets.js";
import { buildEjsEntries } from "./ejs-entries.js";
import { buildHtmlBeautifyAssets } from "./html-beautify-assets.js";
import { buildMvuAssets } from "./mvu-assets.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export interface ProjectAssets {
  worldbook_entries: WorldbookDraftEntry[];
  regex_scripts: RegexScriptAsset[];
  tavern_helper_scripts: TavernHelperScriptAsset[];
  ejs_entries: WorldbookDraftEntry[];
  summary: {
    worldbook_entry_count: number;
    regex_script_count: number;
    tavern_helper_script_count: number;
    ejs_entry_count: number;
  };
}

export function buildProjectAssets(project: Project, target: "mvu" | "html" | "ejs" | "all" = "all", extraRegexScripts: RegexScriptAsset[] = []): ProjectAssets {
  const worldbookEntries: WorldbookDraftEntry[] = [];
  const regexScripts: RegexScriptAsset[] = [];
  const tavernHelperScripts: TavernHelperScriptAsset[] = [];
  const ejsEntries: WorldbookDraftEntry[] = [];

  if ((target === "mvu" || target === "all") && project.mvuConfig?.enabled) {
    const mvu = buildMvuAssets(project.mvuConfig);
    worldbookEntries.push(...mvu.worldbookEntries);
    regexScripts.push(...mvu.regexScripts);
    tavernHelperScripts.push(...mvu.tavernHelperScripts);
  }
  if ((target === "html" || target === "all") && project.htmlBeautifyConfig?.enabled) {
    const html = buildHtmlBeautifyAssets(project.htmlBeautifyConfig);
    regexScripts.push(...html.regexScripts);
  }
  if ((target === "ejs" || target === "all") && project.ejsConfig?.enabled) {
    ejsEntries.push(...buildEjsEntries(project.ejsConfig).worldbookEntries);
  }
  if (target === "all") regexScripts.push(...extraRegexScripts);

  const dedupedRegex = dedupeRegex(regexScripts);
  return {
    worldbook_entries: worldbookEntries,
    regex_scripts: dedupedRegex,
    tavern_helper_scripts: tavernHelperScripts,
    ejs_entries: ejsEntries,
    summary: {
      worldbook_entry_count: worldbookEntries.length,
      regex_script_count: dedupedRegex.length,
      tavern_helper_script_count: tavernHelperScripts.length,
      ejs_entry_count: ejsEntries.length,
    },
  };
}

function dedupeRegex(scripts: RegexScriptAsset[]): RegexScriptAsset[] {
  const seen = new Set<string>();
  const result: RegexScriptAsset[] = [];
  for (const script of scripts) {
    const key = `${script.scriptName}\n${script.findRegex}\n${script.promptOnly}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(script);
  }
  return result;
}
