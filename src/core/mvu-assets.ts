import type { MvuConfig } from "../schemas/mvu.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { wrapWithXmlTag } from "../utils/yaml-xml.js";
import { defaultOutputFormat } from "./mvu-template.js";

export const MVU_UPDATE_RULES_TAG = "variable_update_rules";
export const MVU_OUTPUT_FORMAT_TAG = "variable_output_format";
export const MVU_INITVAR_TAG = "initvar";

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
export interface TavernHelperScriptAsset { type: "script"; enabled: boolean; name: string; id?: string; content: string; info: string; button: { enabled: boolean; buttons: Array<{ name: string; visible: boolean }> }; data: Record<string, unknown> }
export interface MvuAssets { worldbookEntries: WorldbookDraftEntry[]; regexScripts: RegexScriptAsset[]; tavernHelperScripts: TavernHelperScriptAsset[] }

const DEFAULT_MVU_BUNDLE = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";
const DEFAULT_MVU_BUTTONS = [{ name: "重新处理变量", visible: true }, { name: "重新读取初始变量", visible: true }, { name: "清除旧楼层变量", visible: false }, { name: "快照楼层", visible: false }, { name: "重演楼层", visible: false }, { name: "重试额外模型解析", visible: false }];

export function buildMvuAssets(mvu: MvuConfig): MvuAssets {
  const outputFormat = mvu.outputFormat?.trim() || defaultOutputFormat();
  const worldbookEntries: WorldbookDraftEntry[] = [entry("[initvar]变量初始化勿开", wrapWithXmlTag(mvu.initvar ?? "", MVU_INITVAR_TAG), false, "before_char")];
  if (mvu.variableListPath !== null) worldbookEntries.push({ ...entry("变量列表", `<status_current_variable>\n{{format_message_variable::${mvu.variableListPath ?? "stat_data"}}}\n</status_current_variable>`, true, "at_depth"), depth: 0 });
  worldbookEntries.push(
    { ...entry("[mvu_update]变量更新规则", wrapWithXmlTag(mvu.updateRules ?? "", MVU_UPDATE_RULES_TAG), true, "at_depth"), depth: 0 },
    { ...entry("[mvu_update]变量输出格式", wrapWithXmlTag(outputFormat, MVU_OUTPUT_FORMAT_TAG), true, "at_depth"), depth: 0 },
  );
  return { worldbookEntries, regexScripts: buildRegexScripts(mvu), tavernHelperScripts: [tavernScript("MVU", DEFAULT_MVU_BUNDLE, DEFAULT_MVU_BUTTONS), tavernScript("变量结构", mvu.schemaScript ?? "", [])] };
}

function entry(comment: string, content: string, enabled: boolean, position: WorldbookDraftEntry["position"]): WorldbookDraftEntry {
  return { comment, entryType: "other", keys: [], secondaryKeys: [], content, constant: true, position, order: 14720, enabled, preventRecursion: true, excludeRecursion: true };
}

function buildRegexScripts(mvu: MvuConfig): RegexScriptAsset[] {
  const scripts: RegexScriptAsset[] = [];
  if (mvu.hideRegex) {
    scripts.push(regexScript({ id: "mvu-hide-update-variable", scriptName: "[不发送]去除变量更新", findRegex: "/<UpdateVariable>(.*?)<\\/UpdateVariable>/gis", replaceString: "", markdownOnly: false, promptOnly: true, placement: [1, 2], minDepth: 4 }));
    scripts.push(regexScript({ id: "mvu-hide-status-placeholder", scriptName: "[不发送]界面占位符", findRegex: "/<StatusPlaceHolderImpl\\/>/gs", replaceString: "", markdownOnly: false, promptOnly: true, placement: [1, 2], runOnEdit: true }));
  }
  if (mvu.beautifyRegex) {
    scripts.push(
      regexScript({ id: "mvu-display-update-variable", scriptName: "[美化]完整变量更新", findRegex: "/<UpdateVariable>(.*?)<\\/UpdateVariable>/gis", replaceString: "<details><summary>变量更新完成</summary>\n$1\n</details>", markdownOnly: true, promptOnly: false, placement: [2] }),
      regexScript({ id: "mvu-display-updating-variable", scriptName: "[美化]变量更新中", findRegex: "/<updatevariable>(?!.*<\\/updatevariable>)\\s*(.*)\\s*$/gsi", replaceString: "<details><summary>变量更新中...</summary>\n$1\n</details>", markdownOnly: true, promptOnly: false, placement: [2] }),
    );
  }
  return scripts;
}

function regexScript(input: Partial<RegexScriptAsset> & { scriptName: string; findRegex: string; replaceString: string }): RegexScriptAsset {
  return { id: input.id, scriptName: input.scriptName, findRegex: input.findRegex, replaceString: input.replaceString, trimStrings: [], placement: input.placement ?? [2], disabled: false, markdownOnly: input.markdownOnly ?? true, promptOnly: input.promptOnly ?? false, runOnEdit: input.runOnEdit ?? false, substituteRegex: input.substituteRegex ?? 0, minDepth: input.minDepth ?? null, maxDepth: input.maxDepth ?? null };
}

function tavernScript(name: string, content: string, buttons: Array<{ name: string; visible: boolean }>): TavernHelperScriptAsset {
  return { type: "script", enabled: true, name, content, info: "", button: { enabled: true, buttons }, data: {} };
}
