import type { MvuConfig } from "../schemas/mvu.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { normalizeMvuYamlField, wrapWithXmlTag } from "../utils/yaml-xml.js";

export const MVU_UPDATE_RULES_TAG = "variable_update_rules";
export const MVU_OUTPUT_FORMAT_TAG = "variable_output_format";
export const MVU_INITVAR_TAG = "initvar";
export const MVU_VARIABLE_LIST_TAG = "status_current_variable";
export const DEFAULT_MVU_OUTPUT_FORMAT = `变量输出格式:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands must strictly follow the JSON Patch (RFC 6902) standard and must be a valid JSON array containing operation objects
    - only the following operations are allowed:
      - replace: replace the value of existing paths
      - add: add a new key to an object or insert an item into an array; use \`-\` as the array index to append to the end
      - remove: remove an object key or array item
    - don't update field names starts with \`_\` as they are readonly, such as \`_变量\`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words)
    - \${calculate time passed: ...}
    - \${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - \${analyze every variable based on its corresponding \`check\`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "\${/path/to/variable}", "value": "\${new_value}" },
      { "op": "add", "path": "\${/path/to/object/new_key}", "value": "\${new_value}" },
      { "op": "add", "path": "\${/path/to/array/-}", "value": "\${new_value}" },
      { "op": "remove", "path": "\${/path/to/object/key}" },
      { "op": "remove", "path": "\${/path/to/array/0}" }
    ]
    </JSONPatch>
    </UpdateVariable>`;

export const MVU_ENTRY_IDS = {
  initvar: "mvu-initvar",
  variableList: "mvu-variable-list",
  updateRules: "mvu-update-rules",
  outputFormat: "mvu-output-format",
} as const;

export type MvuEntryKey = keyof typeof MVU_ENTRY_IDS;
export const MVU_ENTRY_KEYS = Object.keys(MVU_ENTRY_IDS) as MvuEntryKey[];
export const MVU_ENTRY_ID_TO_KEY = Object.fromEntries(MVU_ENTRY_KEYS.map((key) => [MVU_ENTRY_IDS[key], key])) as Record<string, MvuEntryKey | undefined>;

export interface MvuContentView {
  initvar: string;
  updateRules: string;
  outputFormat?: string;
}

const DEFAULT_ENTRY_META: Record<MvuEntryKey, Pick<WorldbookDraftEntry, "comment" | "order" | "position" | "enabled" | "depth">> = {
  initvar: { comment: "[initvar]变量初始化", order: 14720, position: "at_depth", depth: 0, enabled: true },
  variableList: { comment: "变量列表", order: 14721, position: "at_depth", depth: 0, enabled: true },
  updateRules: { comment: "[mvu_update]变量更新规则", order: 14722, position: "at_depth", depth: 0, enabled: true },
  outputFormat: { comment: "[mvu_update]变量输出格式", order: 14723, position: "at_depth", depth: 0, enabled: true },
};

export function mvuEntryKeyFromId(id: string): MvuEntryKey | undefined {
  return MVU_ENTRY_ID_TO_KEY[id];
}

export function createMvuSystemEntries(input: { runtime: MvuConfig; initvar?: string; updateRules?: string; outputFormat?: string }): WorldbookDraftEntry[] {
  const variableListPath = input.runtime.variableListPath ?? "stat_data";
  return [
    createMvuSystemEntry("initvar", wrapWithXmlTag(input.initvar ?? "", MVU_INITVAR_TAG)),
    ...(input.runtime.variableListPath === null ? [] : [createMvuSystemEntry("variableList", `<${MVU_VARIABLE_LIST_TAG}>\n{{format_message_variable::${variableListPath}}}\n</${MVU_VARIABLE_LIST_TAG}>`)]),
    createMvuSystemEntry("updateRules", wrapWithXmlTag(input.updateRules ?? "", MVU_UPDATE_RULES_TAG)),
    createMvuSystemEntry("outputFormat", wrapWithXmlTag(input.outputFormat?.trim() || DEFAULT_MVU_OUTPUT_FORMAT, MVU_OUTPUT_FORMAT_TAG)),
  ];
}

export function createMvuSystemEntry(key: MvuEntryKey, content: string): WorldbookDraftEntry {
  const meta = DEFAULT_ENTRY_META[key];
  return { comment: meta.comment, entryType: "other", keys: [], secondaryKeys: [], content, constant: true, position: meta.position, order: meta.order, enabled: meta.enabled, depth: meta.depth, preventRecursion: true, excludeRecursion: true };
}

export function normalizeMvuEntryContent(key: MvuEntryKey, content: string, runtime?: MvuConfig): string {
  if (key === "initvar") return wrapWithXmlTag(normalizeMvuYamlField(content, [MVU_INITVAR_TAG]), MVU_INITVAR_TAG);
  if (key === "updateRules") return wrapWithXmlTag(normalizeMvuYamlField(content, [MVU_UPDATE_RULES_TAG]), MVU_UPDATE_RULES_TAG);
  if (key === "outputFormat") return wrapWithXmlTag(normalizeMvuYamlField(content, [MVU_OUTPUT_FORMAT_TAG]).trim() || DEFAULT_MVU_OUTPUT_FORMAT, MVU_OUTPUT_FORMAT_TAG);
  const path = parseVariableListPath(content) ?? runtime?.variableListPath ?? "stat_data";
  return `<${MVU_VARIABLE_LIST_TAG}>\n{{format_message_variable::${path}}}\n</${MVU_VARIABLE_LIST_TAG}>`;
}

export function mvuContentFromEntries(entries: WorldbookDraftEntry[]): MvuContentView {
  return mvuContentFromEntryRecords(entries.map((entry) => ({ entry })));
}

export function mvuContentFromEntryRecords(records: Array<{ id?: string; entry: WorldbookDraftEntry }>): MvuContentView {
  const contentByKey: Partial<Record<MvuEntryKey, string>> = {};
  const commentToKey = new Map(Object.entries(DEFAULT_ENTRY_META).map(([key, meta]) => [meta.comment, key as MvuEntryKey]));
  for (const record of records) {
    const key = record.id ? mvuEntryKeyFromId(record.id) : commentToKey.get(record.entry.comment);
    if (key) contentByKey[key] = record.entry.content;
  }
  return {
    initvar: normalizeMvuYamlField(contentByKey.initvar ?? "", [MVU_INITVAR_TAG]),
    updateRules: normalizeMvuYamlField(contentByKey.updateRules ?? "", [MVU_UPDATE_RULES_TAG]),
    outputFormat: normalizeMvuYamlField(contentByKey.outputFormat ?? "", [MVU_OUTPUT_FORMAT_TAG]) || undefined,
  };
}

export function parseVariableListPath(content: string): string | null {
  const match = content.match(/\{\{\s*format_message_variable::([^}\s]+)\s*\}\}/);
  return match?.[1]?.trim() || null;
}
