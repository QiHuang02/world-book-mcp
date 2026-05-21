import type { MvuConfig } from "../schemas/mvu.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export interface RegexScriptAsset {
  id?: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: number[];
  disabled: boolean;
  markdownOnly: boolean;
  promptOnly: boolean;
  runOnEdit: boolean;
  substituteRegex: number;
  minDepth: number | null;
  maxDepth: number | null;
}

export interface TavernHelperScriptAsset {
  type: "script";
  enabled: boolean;
  name: string;
  id?: string;
  content: string;
  info: string;
  button: { enabled: boolean; buttons: Array<{ name: string; visible: boolean }> };
  data: Record<string, unknown>;
}

export interface MvuAssets {
  worldbookEntries: WorldbookDraftEntry[];
  regexScripts: RegexScriptAsset[];
  tavernHelperScripts: TavernHelperScriptAsset[];
}

export const DEFAULT_MVU_BUNDLE = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";

export const DEFAULT_MVU_BUTTONS = [
  { name: "重新处理变量", visible: true },
  { name: "重新读取初始变量", visible: true },
  { name: "清除旧楼层变量", visible: false },
  { name: "快照楼层", visible: false },
  { name: "重演楼层", visible: false },
  { name: "重试额外模型解析", visible: false },
];

export function buildMvuAssets(mvu: MvuConfig): MvuAssets {
  if (!mvu.enabled) return { worldbookEntries: [], regexScripts: [], tavernHelperScripts: [] };

  const worldbookEntries: WorldbookDraftEntry[] = [
    {
      comment: "[initvar]变量初始化勿开",
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: wrapInitvar(mvu.initvar),
      constant: true,
      position: "before_char",
      order: 14720,
      enabled: false,
      preventRecursion: true,
      excludeRecursion: true,
    },
  ];

  if (mvu.variable_list_path !== false) {
    worldbookEntries.push({
      comment: "变量列表",
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: `---\n<status_current_variable>\n{{format_message_variable::${mvu.variable_list_path}}}\n</status_current_variable>`,
      constant: true,
      position: "at_depth",
      order: 14720,
      enabled: true,
      depth: 0,
      preventRecursion: true,
      excludeRecursion: true,
    });
  }

  worldbookEntries.push(
    {
      comment: "[mvu_update]变量更新规则",
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: mvu.update_rules,
      constant: true,
      position: "at_depth",
      order: 14720,
      enabled: true,
      depth: 0,
      preventRecursion: true,
      excludeRecursion: true,
    },
    {
      comment: "[mvu_update]变量输出格式",
      entryType: "other",
      keys: [],
      secondaryKeys: [],
      content: mvu.output_format?.trim() || defaultOutputFormat(),
      constant: true,
      position: "at_depth",
      order: 14720,
      enabled: true,
      depth: 0,
      preventRecursion: true,
      excludeRecursion: true,
    },
  );

  return {
    worldbookEntries,
    regexScripts: buildRegexScripts(mvu),
    tavernHelperScripts: [
      tavernScript("MVU", DEFAULT_MVU_BUNDLE, DEFAULT_MVU_BUTTONS),
      tavernScript("变量结构", mvu.schema_script, []),
    ],
  };
}

function buildRegexScripts(mvu: MvuConfig): RegexScriptAsset[] {
  const scripts: RegexScriptAsset[] = [];
  if (mvu.hide_regex) {
    scripts.push(regexScript({
      scriptName: "[不发送]去除变量更新",
      findRegex: "/<UpdateVariable>(.*?)<\\/UpdateVariable>/gis",
      replaceString: "",
      markdownOnly: false,
      promptOnly: true,
      placement: [1, 2],
      minDepth: 4,
    }));
  }
  if (mvu.beautify_regex) {
    scripts.push(
      regexScript({
        scriptName: "[美化]完整变量更新",
        findRegex: "/<UpdateVariable>(.*?)<\\/UpdateVariable>/gis",
        replaceString: "<details><summary>变量更新完成</summary>\n$1\n</details>",
        markdownOnly: true,
        promptOnly: false,
        placement: [2],
      }),
      regexScript({
        scriptName: "[美化]变量更新中",
        findRegex: "/<updatevariable>(?!.*<\\/updatevariable>)\\s*(.*)\\s*$/gsi",
        replaceString: "<details><summary>变量更新中...</summary>\n$1\n</details>",
        markdownOnly: true,
        promptOnly: false,
        placement: [2],
      }),
    );
  }
  return scripts;
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

function tavernScript(name: string, content: string, buttons: Array<{ name: string; visible: boolean }>): TavernHelperScriptAsset {
  return { type: "script", enabled: true, name, content, info: "", button: { enabled: true, buttons }, data: {} };
}

function wrapInitvar(initvar: string): string {
  const trimmed = initvar.trim();
  if (trimmed.startsWith("<initvar>")) return trimmed;
  return `<initvar>\n${trimmed}\n</initvar>`;
}

function defaultOutputFormat(): string {
  return `---\n变量输出格式:\n  rule:\n    - 你必须在回复末尾输出更新分析和实际的更新命令\n    - 更新命令遵循JSON Patch (RFC 6902)标准\n    - 支持操作: replace/delta/insert/remove\n    - 不要更新以_开头的只读变量\n  format: |-\n    <UpdateVariable>\n    <Analysis>$(按英文输出，不超过80词)\n    - \${计算经过的时间: ...}\n    - \${判断是否允许戏剧性变化: 是/否}\n    - \${基于check分析每个变量: ...}\n    </Analysis>\n    <JSONPatch>\n    [\n      { "op": "replace", "path": "\${路径}", "value": "\${新值}" },\n      { "op": "delta", "path": "\${数值路径}", "value": \${变动值} },\n      { "op": "insert", "path": "\${对象路径/新键}", "value": "\${新值}" },\n      { "op": "remove", "path": "\${对象路径/键}" }\n    ]\n    </JSONPatch>\n    </UpdateVariable>`;
}
