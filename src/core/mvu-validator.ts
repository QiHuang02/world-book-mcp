import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeMvuPaths, type MvuPathAnalysis } from "./mvu-path-analyzer.js";
import { normalizeIssue, sectionFromIssues, withValid, type ValidationSection } from "./validation-types.js";

export type MvuValidationResult = ValidationSection<ReturnType<typeof summary>>;
export function validateMvuConfig(input: { mvu: MvuConfig; characterCardConfig?: CharacterCardConfig; analysis?: MvuPathAnalysis }): MvuValidationResult {
  const { mvu } = input;
  const analysis = input.analysis ?? analyzeMvuPaths(mvu);
  const issues = [...analysis.parse_warnings];
  if (!mvu.schemaScript.trim()) issues.push(normalizeIssue({ code: "mvu.schema.empty", field: "schemaScript", severity: "error", message: "MVU schemaScript 不能为空" }));
  if (!/export\s+const\s+Schema\s*=\s*z\.object/.test(mvu.schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.missing", field: "schemaScript", severity: "error", message: "schemaScript 必须包含 export const Schema = z.object(...)" }));
  if (!/registerMvuSchema\s*\(\s*Schema\s*\)/.test(mvu.schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.register_missing", field: "schemaScript", severity: "error", message: "schemaScript 必须包含 registerMvuSchema(Schema)" }));
  if (!mvu.initvar.trim()) issues.push(normalizeIssue({ code: "mvu.initvar.empty", field: "initvar", severity: "warning", message: "initvar 为空" }));
  if (!mvu.updateRules.trim()) issues.push(normalizeIssue({ code: "mvu.update_rules.empty", field: "updateRules", severity: "warning", message: "updateRules 为空" }));
  const schemaPaths = new Set(analysis.schema_paths.map((item) => item.path));
  for (const path of analysis.initvar_paths) if (path && !schemaPaths.has(path)) issues.push(normalizeIssue({ code: "mvu.initvar.unknown_path", field: "initvar", severity: "error", message: `initvar 路径不存在于 schema：${path}` }));
  for (const path of analysis.update_rule_paths) if (path && !schemaPaths.has(path)) issues.push(normalizeIssue({ code: "mvu.update_rules.unknown_path", field: "updateRules", severity: "error", message: `updateRules 路径不存在于 schema：${path}` }));
  if (mvu.outputFormat) for (const path of analysis.hidden_paths) if (mvu.outputFormat.includes(path.split(".").at(-1) ?? path)) issues.push(normalizeIssue({ code: "mvu.hidden.output_format", field: "outputFormat", severity: "error", message: `hidden 变量不应进入 outputFormat：${path}` }));
  if (mvu.variableListPath === null) issues.push(normalizeIssue({ code: "mvu.variable_list_path.null", field: "variableListPath", severity: "warning", message: "variableListPath 为 null，将不会生成变量列表条目" }));
  return withValid(sectionFromIssues(issues, summary(mvu, analysis)));
}
function summary(mvu: MvuConfig, analysis: MvuPathAnalysis) { return { enabled: true, variable_list_path: mvu.variableListPath, schema_path_count: analysis.schema_paths.length, initvar_path_count: analysis.initvar_paths.length, update_rule_path_count: analysis.update_rule_paths.length, readonly_path_count: analysis.readonly_paths.length, hidden_path_count: analysis.hidden_paths.length }; }
