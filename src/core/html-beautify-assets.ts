import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import type { RegexScriptAsset } from "./mvu-assets.js";

export interface HtmlBeautifyAssets {
  statusbarHtml?: string;
  scopedCss?: string;
  regexScripts: RegexScriptAsset[];
  summary: { statusbar_enabled: boolean; generated_regex_script_count: number };
}

export function buildHtmlBeautifyAssets(html: HtmlBeautifyConfig): HtmlBeautifyAssets {
  const scripts: RegexScriptAsset[] = [];
  const statusbarEnabled = html.target === "statusbar" || html.target === "both";
  if (statusbarEnabled && html.regexPolicy.generateStatusbarRegex) {
    scripts.push(regexScript({ scriptName: "[界面]状态栏", findRegex: "/<StatusPlaceHolderImpl\\/>/gs", replaceString: html.statusbar.html, markdownOnly: true, promptOnly: false, placement: [2], runOnEdit: true }));
  }
  if (statusbarEnabled && html.statusbar.hideRegex && html.regexPolicy.generateHideRegex) {
    scripts.push(regexScript({ scriptName: "[不发送]界面占位符", findRegex: "/<StatusPlaceHolderImpl\\/>/gs", replaceString: "", markdownOnly: false, promptOnly: true, placement: [2], runOnEdit: true }));
  }
  return { statusbarHtml: html.statusbar.html, scopedCss: html.statusbar.scopedCss, regexScripts: scripts, summary: { statusbar_enabled: statusbarEnabled, generated_regex_script_count: scripts.length } };
}

function regexScript(input: Partial<RegexScriptAsset> & { scriptName: string; findRegex: string; replaceString: string }): RegexScriptAsset {
  return { scriptName: input.scriptName, findRegex: input.findRegex, replaceString: input.replaceString, trimStrings: [], placement: input.placement ?? [2], disabled: false, markdownOnly: input.markdownOnly ?? true, promptOnly: input.promptOnly ?? false, runOnEdit: input.runOnEdit ?? false, substituteRegex: input.substituteRegex ?? 0, minDepth: input.minDepth ?? null, maxDepth: input.maxDepth ?? null };
}
