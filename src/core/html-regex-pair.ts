import type { RegexScriptAsset } from "./mvu-assets.js";

export type RegexPairScope = "statusbar" | "global" | "start_picker";

export interface HtmlRegexPairInput {
  scope: RegexPairScope;
  find_regex?: string;
  display_html: string;
  hide_regex?: boolean;
  display_name?: string;
  hide_name?: string;
  placement?: number[];
  min_depth?: number | null;
  max_depth?: number | null;
}

export interface HtmlRegexPairResult {
  scripts: RegexScriptAsset[];
  rules: string[];
}

const DEFAULT_FIND: Record<RegexPairScope, string> = {
  statusbar: "/<StatusPlaceHolderImpl\\/>/gs",
  global: "/(.*)<StatusPlaceHolderImpl\\/>/gs",
  start_picker: "/<start>([\\s\\S]*?)<\\/start>/g",
};

export function createHtmlRegexPairTemplate(input: HtmlRegexPairInput): HtmlRegexPairResult {
  const findRegex = input.find_regex ?? DEFAULT_FIND[input.scope];
  const placement = input.placement ?? [1, 2];
  const display_name = input.display_name ?? defaultDisplayName(input.scope);
  const hide_name = input.hide_name ?? defaultHideName(input.scope);
  const hideRegex = input.hide_regex ?? true;

  const scripts: RegexScriptAsset[] = [];
  scripts.push(buildScript({
    scriptName: display_name,
    findRegex,
    replaceString: input.display_html,
    markdownOnly: true,
    promptOnly: false,
    placement,
    runOnEdit: true,
    minDepth: input.min_depth ?? null,
    maxDepth: input.max_depth ?? null,
  }));

  if (hideRegex) {
    scripts.push(buildScript({
      scriptName: hide_name,
      findRegex,
      replaceString: input.scope === "global" ? "$1" : "",
      markdownOnly: false,
      promptOnly: true,
      placement,
      runOnEdit: true,
      minDepth: input.min_depth ?? null,
      maxDepth: input.max_depth ?? null,
    }));
  }

  return {
    scripts,
    rules: [
      "display 与 prompt 两条 regex 必须使用相同 findRegex",
      "promptOnly 规则的 replaceString 必须留空（global 范围允许保留 $1 捕获原文）",
      "全局美化时 replaceString 必须包含 <StatusPlaceHolderImpl/> 占位以兼容状态栏",
      "placement 推荐 [1,2]，runOnEdit 设为 true",
    ],
  };
}

function defaultDisplayName(scope: RegexPairScope): string {
  if (scope === "statusbar") return "[界面]状态栏";
  if (scope === "global") return "[界面]全局美化";
  return "[界面]开场选择";
}

function defaultHideName(scope: RegexPairScope): string {
  if (scope === "statusbar") return "[不发送]界面占位符";
  if (scope === "global") return "[不发送]全局美化原文";
  return "[不发送]开场选择原文";
}

function buildScript(input: Partial<RegexScriptAsset> & { scriptName: string; findRegex: string; replaceString: string }): RegexScriptAsset {
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
