import type { HtmlBeautifyConfig, HtmlRegexScriptConfig } from "../schemas/html-beautify.js";
import type { RegexScriptAsset } from "./mvu-assets.js";

export interface HtmlBeautifyAssets {
  regexScripts: RegexScriptAsset[];
}

export function buildHtmlBeautifyAssets(html: HtmlBeautifyConfig): HtmlBeautifyAssets {
  if (!html.enabled) return { regexScripts: [] };
  const scripts: RegexScriptAsset[] = [];

  if (html.statusbar.enabled && (html.target === "statusbar" || html.target === "both")) {
    scripts.push(regexScript({
      scriptName: "[界面]状态栏",
      findRegex: "/<StatusPlaceHolderImpl\\/>/gs",
      replaceString: html.statusbar.html,
      markdownOnly: true,
      promptOnly: false,
      placement: [2],
      runOnEdit: true,
    }));
    if (html.statusbar.hide_regex) {
      scripts.push(regexScript({
        scriptName: "[不发送]界面占位符",
        findRegex: "/<StatusPlaceHolderImpl\\/>/gs",
        replaceString: "",
        markdownOnly: false,
        promptOnly: true,
        placement: [2],
        runOnEdit: true,
      }));
    }
  }

  if (html.global.enabled && (html.target === "global" || html.target === "both")) {
    scripts.push(...html.global.regex_scripts.map(fromConfig));
  }

  return { regexScripts: scripts };
}

function fromConfig(config: HtmlRegexScriptConfig): RegexScriptAsset {
  return regexScript({
    scriptName: config.name,
    findRegex: config.findRegex,
    replaceString: config.replaceString,
    markdownOnly: config.markdownOnly,
    promptOnly: config.promptOnly,
    placement: config.placement,
    runOnEdit: config.runOnEdit,
  });
}

function regexScript(input: Partial<RegexScriptAsset> & { scriptName: string; findRegex: string; replaceString: string }): RegexScriptAsset {
  return {
    scriptName: input.scriptName,
    findRegex: input.findRegex,
    replaceString: input.replaceString,
    trimStrings: [],
    placement: input.placement ?? [2],
    disabled: false,
    markdownOnly: input.markdownOnly ?? true,
    promptOnly: input.promptOnly ?? false,
    runOnEdit: input.runOnEdit ?? false,
    substituteRegex: input.substituteRegex ?? 0,
    minDepth: input.minDepth ?? null,
    maxDepth: input.maxDepth ?? null,
  };
}
