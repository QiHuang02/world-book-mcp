import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { MvuConfig } from "../schemas/mvu.js";
import { analyzeMvuPaths, normalizePath, type MvuPathAnalysis } from "./mvu-path-analyzer.js";
import { issue, section, splitIssues, withValid, type ValidationIssue, type ValidationSection } from "./validation-types.js";

export type MvuValidationResult = ValidationSection<{
  enabled: boolean;
  schema_path_count: number;
  initvar_path_count: number;
  update_rule_path_count: number;
  readonly_path_count: number;
  hidden_path_count: number;
}> & { valid: boolean };

export function validateMvuConfig(input: { mvu: MvuConfig; characterCardConfig?: CharacterCardConfig; analysis?: MvuPathAnalysis }): MvuValidationResult {
  const { mvu, characterCardConfig } = input;
  const analysis = input.analysis ?? analyzeMvuPaths(mvu);
  const issues: ValidationIssue[] = [...analysis.parse_warnings];

  if (!mvu.enabled) return withValid(section({ summary: summary(mvu, analysis) }));

  if (mvu.style !== "zod") issues.push(issue({ code: "mvu.style.unsupported", field: "style", severity: "error", message: "当前仅支持 zod 风格 MVU" }));
  if (!mvu.schema_script.trim()) issues.push(issue({ code: "mvu.schema.empty", field: "schema_script", severity: "error", message: "schema_script 不能为空" }));
  if (!/export\s+const\s+Schema\s*=\s*z\.object\s*\(/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.missing_export", field: "schema_script", severity: "error", message: "schema_script 必须包含 export const Schema = z.object(...)" }));
  if (!/registerMvuSchema\s*\(\s*Schema\s*\)/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.missing_register", field: "schema_script", severity: "error", message: "schema_script 必须调用 registerMvuSchema(Schema)" }));
  if ((mvu.schema_script.match(/registerMvuSchema\s*\(/g) ?? []).length > 1) issues.push(issue({ code: "mvu.schema.duplicate_register", field: "schema_script", severity: "error", message: "schema_script 不应重复调用 registerMvuSchema" }));

  const sanitizedSchema = stripStringsAndComments(mvu.schema_script);
  const sanitizedUpdateRules = stripStringsAndComments(mvu.update_rules);
  const sanitizedOutputFormat = stripStringsAndComments(mvu.output_format ?? "");
  if (containsBetaKeyword(sanitizedSchema) || containsBetaKeyword(sanitizedUpdateRules) || /\/stat_data\//.test(sanitizedOutputFormat)) issues.push(issue({ code: "mvu.beta_mixed", field: "schema_script", severity: "error", message: "MVU 配置疑似混用 Beta 路径/命令风格，请统一使用 ZOD + YAML 更新规则" }));

  if (/import\s+.*\b(z|_)\b/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.injected_import", field: "schema_script", severity: "warning", message: "z 和 _ 由环境注入，通常不应手动 import" }));
  if (/\.(?:strict|passthrough|optional)\s*\(/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.forbidden_zod_method", field: "schema_script", severity: "error", message: "MVU ZOD 脚本不应使用 .strict()/.passthrough()/.optional()" }));
  if (/\.default\s*\(/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.default_instead_prefault", field: "schema_script", severity: "warning", message: "MVU 默认值建议使用 .prefault() 而非 .default()" }));
  if (/\.(?:min|max)\s*\(/.test(mvu.schema_script)) issues.push(issue({ code: "mvu.schema.min_max", field: "schema_script", severity: "warning", message: "数值范围建议使用 transform(v => _.clamp(v, min, max))，避免 min/max 直接拒绝更新" }));

  if (!mvu.initvar.trim()) issues.push(issue({ code: "mvu.initvar.empty", field: "initvar", severity: "error", message: "initvar 不能为空" }));
  if (mvu.initvar.includes("<initvar>")) issues.push(issue({ code: "mvu.initvar.xml_wrapped", field: "initvar", severity: "warning", message: "initvar 应填写纯 YAML，builder 会自动包裹 <initvar>" }));
  if (containsYamlDocSeparator(mvu.initvar)) issues.push(issue({ code: "mvu.initvar.doc_separator", field: "initvar", severity: "warning", message: "initvar 不应包含 YAML 文档分隔符 `---`，仅写纯 YAML 即可" }));

  if (!mvu.update_rules.trim()) issues.push(issue({ code: "mvu.update_rules.empty", field: "update_rules", severity: "error", message: "update_rules 不能为空" }));
  if (/<\/?variable_update_rules>/i.test(mvu.update_rules)) issues.push(issue({ code: "mvu.update_rules.xml_wrapped", field: "update_rules", severity: "warning", message: "update_rules 应填写纯 YAML，builder 会自动包裹 <variable_update_rules>" }));
  if (containsYamlDocSeparator(mvu.update_rules)) issues.push(issue({ code: "mvu.update_rules.doc_separator", field: "update_rules", severity: "warning", message: "update_rules 不应包含 YAML 文档分隔符 `---`，仅写纯 YAML 即可" }));
  if (mvu.output_format && /<\/?variable_output_format>/i.test(mvu.output_format)) issues.push(issue({ code: "mvu.output_format.xml_wrapped", field: "output_format", severity: "warning", message: "output_format 应填写纯 YAML，builder 会自动包裹 <variable_output_format>" }));

  const schemaPaths = new Set(analysis.schema_paths.map((item) => item.path));
  const schemaWithoutDefaults = analysis.schema_paths.filter((item) => !item.has_default && !item.readonly && !item.hidden).map((item) => item.path);
  for (const path of analysis.initvar_paths) {
    if (path && !schemaPaths.has(path)) issues.push(issue({ code: "mvu.initvar.unknown_path", field: "initvar", severity: "error", message: `initvar 路径不存在于 schema：${path}`, related_tools: ["validate_draft(scope='mvu')", "rewrite_mvu_variables"] }));
  }
  for (const path of schemaWithoutDefaults) {
    if (!analysis.initvar_paths.includes(path)) issues.push(issue({ code: "mvu.initvar.missing_required", field: "initvar", severity: "error", message: `schema 普通变量缺少默认值且未出现在 initvar：${path}` }));
  }
  for (const variable of analysis.schema_paths.filter((item) => item.has_default)) {
    if (!analysis.initvar_paths.includes(variable.path)) issues.push(issue({ code: "mvu.initvar.missing_prefault", field: "initvar", severity: "warning", message: `schema 变量有默认值但 initvar 未列出：${variable.path}` }));
  }
  for (const path of analysis.update_rule_paths) {
    if (path && !schemaPaths.has(path)) issues.push(issue({ code: "mvu.update_rules.unknown_path", field: "update_rules", severity: "error", message: `update_rules 路径不存在于 schema：${path}` }));
    if (analysis.readonly_paths.includes(path)) issues.push(issue({ code: "mvu.update_rules.readonly_path", field: "update_rules", severity: "error", message: `_ 前缀只读变量不得被 AI 更新：${path}` }));
  }
  if (/(?:^|\s)\/(?:stat_data\/)?|getvar\s*\(|_\.(?:set|add)\s*\(/.test(sanitizedUpdateRules)) issues.push(issue({ code: "mvu.update_rules.beta_path", field: "update_rules", severity: "error", message: "update_rules 不得混用 Beta 路径如 /stat_data/...、getvar(...) 或 _.set/_.add" }));

  for (const path of extractOutputFormatPaths(mvu.output_format ?? "")) {
    const normalized = normalizePath(path);
    if (normalized && !schemaPaths.has(normalized)) issues.push(issue({ code: "mvu.output_format.unknown_path", field: "output_format", severity: "error", message: `output_format 引用的路径不存在：${normalized}` }));
    if (analysis.hidden_paths.includes(normalized)) issues.push(issue({ code: "mvu.output_format.hidden_path", field: "output_format", severity: "error", message: `$ 前缀隐藏变量不得输出：${normalized}` }));
  }
  if (mvu.variable_list_path !== null && mvu.variable_list_path !== "stat_data") issues.push(issue({ code: "mvu.variable_list_path.nonstandard", field: "variable_list_path", severity: "warning", message: "variable_list_path 如果不是 stat_data 或 null，可能导致 EJS/HTML 路径不一致" }));

  if (characterCardConfig) {
    [characterCardConfig.card.first_mes, ...characterCardConfig.card.alternate_greetings].forEach((greeting, index) => {
      if (!greeting.includes("<StatusPlaceHolderImpl/>")) issues.push(issue({ code: "mvu.greeting.missing_status_placeholder", field: index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`, severity: "error", message: "启用 MVU 时开场白必须包含 <StatusPlaceHolderImpl/> 状态栏占位符" }));
    });
  }

  return withValid(section({ ...splitIssues(issues), summary: summary(mvu, analysis) }));
}

function summary(mvu: MvuConfig, analysis: MvuPathAnalysis): MvuValidationResult["summary"] {
  return { enabled: mvu.enabled, schema_path_count: analysis.schema_paths.length, initvar_path_count: analysis.initvar_paths.length, update_rule_path_count: analysis.update_rule_paths.length, readonly_path_count: analysis.readonly_paths.length, hidden_path_count: analysis.hidden_paths.length };
}

function extractOutputFormatPaths(value: string): string[] {
  return [...value.matchAll(/stat_data(?:\.[\p{L}\p{N}_$-]+)+|[\p{L}_$][\p{L}\p{N}_$-]*(?:\.[\p{L}\p{N}_$-]+)+/gu)].map((match) => match[0]);
}

function stripStringsAndComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, "$1$1");
}

function containsBetaKeyword(sanitized: string): boolean {
  return /_\.(?:add|set)\s*\(|getvar\s*\(/.test(sanitized);
}

function containsYamlDocSeparator(value: string): boolean {
  return /(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(value);
}
