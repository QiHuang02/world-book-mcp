import type { CharacterCardConfig } from "../schemas/character-card.js";
import type { MvuConfig } from "../schemas/mvu.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export interface MvuValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    enabled: boolean;
    has_schema_script: boolean;
    has_initvar: boolean;
    has_update_rules: boolean;
  };
}

export function validateMvuConfig(input: { mvu: MvuConfig; characterCardConfig?: CharacterCardConfig }): MvuValidationResult {
  const { mvu, characterCardConfig } = input;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!mvu.enabled) {
    return { valid: true, errors, warnings, summary: summary(mvu) };
  }

  if (mvu.style !== "zod") {
    errors.push({ field: "style", severity: "error", message: "当前仅支持 zod 风格 MVU" });
  }
  if (!mvu.schema_script.trim()) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 不能为空" });
  }
  if (!mvu.schema_script.includes("registerMvuSchema")) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 必须包含 registerMvuSchema" });
  }
  if (!/export\s+const\s+Schema\s*=\s*z\.object\s*\(/.test(mvu.schema_script)) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 必须包含 export const Schema = z.object(...)" });
  }
  if (!/registerMvuSchema\s*\(\s*Schema\s*\)/.test(mvu.schema_script)) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 必须调用 registerMvuSchema(Schema)" });
  }
  if ((mvu.schema_script.match(/registerMvuSchema\s*\(/g) ?? []).length > 1) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 不应重复调用 registerMvuSchema" });
  }
  if (containsBetaKeyword(stripStringsAndComments(mvu.schema_script))) {
    errors.push({ field: "schema_script", severity: "error", message: "schema_script 疑似混入 MVU beta 风格，请统一使用 ZOD 风格" });
  }
  if (/import\s+.*\b(z|_)\b/.test(mvu.schema_script)) {
    warnings.push({ field: "schema_script", severity: "warning", message: "z 和 _ 由环境注入，通常不应手动 import" });
  }
  if (/\.(?:strict|passthrough|optional)\s*\(/.test(mvu.schema_script)) {
    errors.push({ field: "schema_script", severity: "error", message: "MVU ZOD 脚本不应使用 .strict()/.passthrough()/.optional()" });
  }
  if (/\.default\s*\(/.test(mvu.schema_script)) {
    warnings.push({ field: "schema_script", severity: "warning", message: "MVU 默认值建议使用 .prefault() 而非 .default()" });
  }
  if (/\.(?:min|max)\s*\(/.test(mvu.schema_script)) {
    warnings.push({ field: "schema_script", severity: "warning", message: "数值范围建议使用 transform(v => _.clamp(v, min, max))，避免 min/max 直接拒绝更新" });
  }
  if (/\.transform\s*\(\s*\([^)]*,[^)]*\)\s*=>/.test(mvu.schema_script)) {
    errors.push({ field: "schema_script", severity: "error", message: "transform 回调应只接受一个参数" });
  }
  if (!mvu.initvar.trim()) {
    errors.push({ field: "initvar", severity: "error", message: "initvar 不能为空" });
  }
  if (mvu.initvar.includes("<initvar>")) {
    warnings.push({ field: "initvar", severity: "warning", message: "initvar 应填写纯 YAML，builder 会自动包裹 <initvar>" });
  }
  if (containsYamlDocSeparator(mvu.initvar)) {
    warnings.push({ field: "initvar", severity: "warning", message: "initvar 不应包含 YAML 文档分隔符 `---`，仅写纯 YAML 即可" });
  }
  if (!mvu.update_rules.trim()) {
    errors.push({ field: "update_rules", severity: "error", message: "update_rules 不能为空" });
  }
  if (/<\/?variable_update_rules>/i.test(mvu.update_rules)) {
    warnings.push({ field: "update_rules", severity: "warning", message: "update_rules 应填写纯 YAML，builder 会自动包裹 <variable_update_rules>" });
  }
  if (containsYamlDocSeparator(mvu.update_rules)) {
    warnings.push({ field: "update_rules", severity: "warning", message: "update_rules 不应包含 YAML 文档分隔符 `---`，仅写纯 YAML 即可" });
  }
  if (mvu.output_format && /<\/?variable_output_format>/i.test(mvu.output_format)) {
    warnings.push({ field: "output_format", severity: "warning", message: "output_format 应填写纯 YAML，builder 会自动包裹 <variable_output_format>" });
  }
  if (mvu.output_format && containsYamlDocSeparator(mvu.output_format)) {
    warnings.push({ field: "output_format", severity: "warning", message: "output_format 不应包含 YAML 文档分隔符 `---`，仅写纯 YAML 即可" });
  }
  const sanitizedUpdateRules = stripStringsAndComments(mvu.update_rules);
  const sanitizedOutputFormat = stripStringsAndComments(mvu.output_format ?? "");
  if (/_\.(?:set|add)\s*\(|getvar\s*\(|\[0\]/.test(sanitizedUpdateRules) || /\/stat_data\//.test(sanitizedOutputFormat)) {
    errors.push({ field: "update_rules", severity: "error", message: "MVU 配置疑似混用 Beta 路径/命令风格，请统一使用 ZOD + JSON Patch" });
  }
  if (/\n\s*_[^:\n]+:\s*\n?[\s\S]{0,80}check\s*:/.test(mvu.update_rules)) {
    warnings.push({ field: "update_rules", severity: "warning", message: "_ 前缀只读变量不应编写更新规则" });
  }
  if (mvu.variable_list_path !== false && !mvu.variable_list_path.trim()) {
    errors.push({ field: "variable_list_path", severity: "error", message: "variable_list_path 不能为空字符串，或显式设为 false" });
  }

  if (characterCardConfig) {
    const greetings = [characterCardConfig.card.first_mes, ...characterCardConfig.card.alternate_greetings];
    greetings.forEach((greeting, index) => {
      if (!greeting.includes("<StatusPlaceHolderImpl/>")) {
        warnings.push({
          field: index === 0 ? "card.first_mes" : `card.alternate_greetings.${index - 1}`,
          severity: "warning",
          message: "启用 MVU 时开场白建议包含 <StatusPlaceHolderImpl/> 状态栏占位符",
        });
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings, summary: summary(mvu) };
}

function summary(mvu: MvuConfig): MvuValidationResult["summary"] {
  return {
    enabled: mvu.enabled,
    has_schema_script: Boolean(mvu.schema_script.trim()),
    has_initvar: Boolean(mvu.initvar.trim()),
    has_update_rules: Boolean(mvu.update_rules.trim()),
  };
}

// 把字符串字面量、模板字符串、行/块注释里的内容替换为占位符，
// 避免因为注释或字符串里写了 _.add(/getvar( 等关键词触发误报。
function stripStringsAndComments(source: string): string {
  if (!source) return "";
  let result = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", i + 2);
      if (end < 0) return result;
      result += "\n";
      i = end + 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) return result;
      i = end + 2;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      const quote = char;
      result += quote;
      i += 1;
      while (i < source.length) {
        const inner = source[i];
        if (inner === "\\") { i += 2; continue; }
        if (inner === quote) { result += quote; i += 1; break; }
        if (inner === "\n") result += "\n";
        i += 1;
      }
      continue;
    }
    result += char;
    i += 1;
  }
  return result;
}

function containsBetaKeyword(sanitized: string): boolean {
  return /_\.(?:add|set)\s*\(|getvar\s*\(/.test(sanitized);
}

/**
 * 检测字段值是否含有 YAML 文档分隔符 `---`（独占一行）。
 * MVU 字段约定存纯 YAML，由 builder 在合成世界书条目时统一包裹 XML，因此这里不应出现裸 `---`。
 */
function containsYamlDocSeparator(value: string): boolean {
  if (!value) return false;
  return /(^|\r?\n)[ \t]*---[ \t]*(?:\r?\n|$)/.test(value);
}
