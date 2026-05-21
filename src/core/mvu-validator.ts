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
  if (["_.add(", "_.set(", "getvar("].some((term) => mvu.schema_script.includes(term))) {
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
  if (!mvu.update_rules.trim()) {
    errors.push({ field: "update_rules", severity: "error", message: "update_rules 不能为空" });
  }
  if (/_.(?:set|add)\(|getvar\(|\[0\]/.test(mvu.update_rules) || /\/stat_data\//.test(mvu.output_format ?? "")) {
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
