import type { Project } from "../schemas/project.js";
import type { RegexSliceData } from "../schemas/regex.js";
import type { RegexScriptAsset, TavernHelperScriptAsset } from "./mvu-assets.js";
import { buildEjsEntries } from "./ejs-entries.js";
import { buildHtmlBeautifyAssets } from "./html-beautify-assets.js";
import { buildMvuAssets } from "./mvu-assets.js";
import { buildRegexArtifact, type RegexArtifact } from "./regex-assets.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export interface ProjectAssets {
  worldbook_entries: WorldbookDraftEntry[];
  regex_scripts: RegexScriptAsset[];
  tavern_helper_scripts: TavernHelperScriptAsset[];
  ejs_entries: WorldbookDraftEntry[];
  regex_artifact: RegexArtifact;
  summary: { entry_count: number; regex_script_count: number; tavern_helper_script_count: number; ejs_entry_count: number };
}

export function buildProjectAssets(project: Project & { mvuConfig?: import("../schemas/mvu.js").MvuConfig; htmlBeautifyConfig?: import("../schemas/html-beautify.js").HtmlBeautifyConfig; ejsConfig?: import("../schemas/ejs.js").EjsConfig }, target: "mvu" | "html" | "regex" | "ejs" | "all" = "all", regexSlices: Array<{ id: string; data: RegexSliceData }> = [], builtAt = new Date().toISOString()): ProjectAssets {
  const worldbookEntries: WorldbookDraftEntry[] = [];
  const tavernHelperScripts: TavernHelperScriptAsset[] = [];
  const ejsEntries: WorldbookDraftEntry[] = [];
  let mvuRegex: RegexScriptAsset[] = [];
  let htmlRegex: RegexScriptAsset[] = [];
  if ((target === "mvu" || target === "regex" || target === "all") && project.mvuConfig) {
    const mvu = buildMvuAssets(project.mvuConfig);
    if (target === "mvu" || target === "all") {
      worldbookEntries.push(...mvu.worldbookEntries);
      tavernHelperScripts.push(...mvu.tavernHelperScripts);
    }
    mvuRegex = mvu.regexScripts;
  }
  if ((target === "html" || target === "regex" || target === "all") && project.htmlBeautifyConfig) {
    const html = buildHtmlBeautifyAssets(project.htmlBeautifyConfig);
    htmlRegex = html.regexScripts;
  }
  if ((target === "ejs" || target === "all") && project.ejsConfig) ejsEntries.push(...buildEjsEntries(project.ejsConfig).worldbookEntries);
  const regexArtifact = buildRegexArtifact({ builtAt, mvuScripts: mvuRegex, htmlScripts: htmlRegex, regexSlices });
  return { worldbook_entries: worldbookEntries, regex_scripts: regexArtifact.scripts, tavern_helper_scripts: tavernHelperScripts, ejs_entries: ejsEntries, regex_artifact: regexArtifact, summary: { entry_count: worldbookEntries.length, regex_script_count: regexArtifact.scripts.length, tavern_helper_script_count: tavernHelperScripts.length, ejs_entry_count: ejsEntries.length } };
}
