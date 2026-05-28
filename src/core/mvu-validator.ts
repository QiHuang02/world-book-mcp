import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeMvuPaths, type MvuPathAnalysis } from "./mvu-path-analyzer.js";
import type { MvuContentView } from "./mvu-entry-templates.js";
import { normalizeIssue, sectionFromIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type MvuValidationResult = ValidationSection<ReturnType<typeof summary>>;

export function validateMvuConfig(input: { mvu: MvuConfig; mvuContent?: MvuContentView; characterCardConfig?: CharacterCardConfig; analysis?: MvuPathAnalysis }): MvuValidationResult {
  const mvu = input.mvu;
  const content = input.mvuContent ?? { initvar: "", updateRules: "", outputFormat: undefined };
  const analysis = input.analysis ?? analyzeMvuPaths({ schemaScript: mvu.schemaScript, initvar: content.initvar, updateRules: content.updateRules });
  const issues: ValidationIssue[] = [...analysis.parseWarnings];
  const schemaScript = mvu.schemaScript ?? "";
  const initvar = content.initvar ?? "";
  const updateRules = content.updateRules ?? "";
  const outputFormat = content.outputFormat ?? "";

  if (!schemaScript.trim()) issues.push(normalizeIssue({ code: "mvu.schema.empty", field: "schemaScript", severity: "error", message: "MVU schemaScript 不能为空" }));
  if (!/export\s+const\s+Schema\s*=\s*z\.object/.test(schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.missing", field: "schemaScript", severity: "error", message: "schemaScript 必须包含 export const Schema = z.object(...)" }));
  if (!/registerMvuSchema\s*\(\s*Schema\s*\)/.test(schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.register_missing", field: "schemaScript", severity: "error", message: "schemaScript 必须包含 registerMvuSchema(Schema)" }));
  if (!/registerMvuSchema/.test(schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.import_missing", field: "schemaScript", severity: "warning", message: "schemaScript 建议导入 registerMvuSchema" }));
  if (hasForbiddenZodMethod(schemaScript)) issues.push(normalizeIssue({ code: "mvu.schema.unsupported_zod", field: "schemaScript", severity: "error", message: "schemaScript 包含不建议用于 MVU zod 变量卡的 optional/nullable/nullish/catch 等方法" }));
  if (containsBetaStyle(stripCommentsAndStrings(schemaScript)) || containsBetaStyle(stripCommentsAndStrings(updateRules))) issues.push(normalizeIssue({ code: "mvu.beta_style", field: "schemaScript/updateRules", severity: "error", message: "检测到旧 MVU Beta 风格的 _.set/_.add/getvar 更新写法，请改用 zod Schema + JSONPatch 输出规则" }));
  if (containsJsAssignmentUpdateRules(updateRules)) issues.push(normalizeIssue({ code: "mvu.update_rules.js_assignment", field: "mvu-update-rules", severity: "error", message: "变量更新规则条目不应包含 JS 赋值或 _.clamp 执行语句；边界约束应放入 schema transform，更新条件写成 YAML" }));
  if (!initvar.trim()) issues.push(normalizeIssue({ code: "mvu.initvar.empty", field: "mvu-initvar", severity: "warning", message: "mvu-initvar 初始变量为空" }));
  if (!updateRules.trim()) issues.push(normalizeIssue({ code: "mvu.update_rules.empty", field: "mvu-update-rules", severity: "warning", message: "mvu-update-rules 为空" }));
  if (outputFormat && !/<UpdateVariable>[\s\S]*<JSONPatch>[\s\S]*<\/JSONPatch>[\s\S]*<\/UpdateVariable>/i.test(outputFormat)) issues.push(normalizeIssue({ code: "mvu.output_format.patch_missing", field: "mvu-output-format", severity: "warning", message: "mvu-output-format 建议包含 <UpdateVariable> 与 <JSONPatch> JSONPatch 输出模板" }));

  const schemaPaths = new Set(analysis.schemaPaths.map((item) => item.path));
  const root = mvu.variableListPath ?? "stat_data";
  const schemaHasRoot = analysis.schemaPaths.some((item) => item.segments[0] === root);
  if (root && !schemaHasRoot && analysis.initvarPaths.some((path) => path === root || path.startsWith(`${root}.`))) issues.push(normalizeIssue({ code: "mvu.initvar.root_mismatch", field: "mvu-initvar", severity: "error", message: `initvar 不应额外包含 ${root}: 根键；schema/initvar 应相对 variableListPath` }));
  if (root && !schemaHasRoot && analysis.updateRulePaths.some((path) => path === root || path.startsWith(`${root}.`))) issues.push(normalizeIssue({ code: "mvu.update_rules.root_mismatch", field: "mvu-update-rules", severity: "error", message: `updateRules 不应额外包含 ${root}: 根键；schema/updateRules 应相对 variableListPath` }));
  const acceptsPath = (relative: string) => schemaPaths.has(relative) || schemaPaths.has(`${root}.${relative}`);
  for (const path of analysis.initvarPaths) {
    const relative = stripRoot(path, root);
    if (relative && !acceptsPath(relative)) issues.push(normalizeIssue({ code: "mvu.initvar.unknown_path", field: "mvu-initvar", severity: "error", message: `initvar 路径不存在于 schema：${relative}` }));
  }
  for (const path of analysis.updateRulePaths) {
    const relative = stripRoot(path, root);
    if (relative && !acceptsPath(relative)) issues.push(normalizeIssue({ code: "mvu.update_rules.unknown_path", field: "mvu-update-rules", severity: "error", message: `updateRules 路径不存在于 schema：${relative}` }));
  }
  if (outputFormat) for (const path of analysis.hiddenPaths) if (outputFormat.includes(path.split(".").at(-1) ?? path)) issues.push(normalizeIssue({ code: "mvu.hidden.output_format", field: "mvu-output-format", severity: "error", message: `hidden 变量不应进入 outputFormat：${path}` }));
  if (mvu.variableListPath === null) issues.push(normalizeIssue({ code: "mvu.variable_list_path.null", field: "variableListPath", severity: "warning", message: "variableListPath 为 null，将不会生成变量列表条目" }));
  return withValid(sectionFromIssues(issues, summary(mvu, analysis)));
}

function stripRoot(path: string, root: string): string {
  return path === root ? "" : path.startsWith(`${root}.`) ? path.slice(root.length + 1) : path;
}

function hasForbiddenZodMethod(script: string): boolean { return /\.(?:optional|nullable|nullish|catch)\s*\(/.test(stripCommentsAndStrings(script)); }
function containsBetaStyle(value: string): boolean { return /(?:_\.(?:set|add|remove|update)\s*\(|\bgetvar\s*\()/.test(value); }
function containsJsAssignmentUpdateRules(value: string): boolean {
  const stripped = stripCommentsAndStrings(value);
  if (/\b_\.clamp\s*\(/.test(stripped)) return true;
  return stripped.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes(":")) return false;
    return /^[\w$][\w$]*(?:\.[\w$][\w$]*)*\s*=\s*.+;?$/.test(trimmed);
  });
}
function stripCommentsAndStrings(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, "");
}
function summary(mvu: MvuConfig, analysis: MvuPathAnalysis) { return { enabled: true, variableListPath: mvu.variableListPath, schemaPathCount: analysis.schemaPaths.length, initvarPathCount: analysis.initvarPaths.length, updateRulePathCount: analysis.updateRulePaths.length, readonlyPathCount: analysis.readonlyPaths.length, hiddenPathCount: analysis.hiddenPaths.length }; }
