import type { EjsConfig } from "../schemas/ejs.js";
import type { MvuConfig } from "../schemas/mvu.js";
import type { ValidationIssue } from "./worldbook-validator.js";

export interface EjsValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: { enabled: boolean; template_type: string; entry_count: number; variable_path_count: number };
}

export function validateEjsConfig(input: { ejs: EjsConfig; mvu?: MvuConfig }): EjsValidationResult {
  const { ejs, mvu } = input;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!ejs.enabled) return { valid: true, errors, warnings, summary: summary(ejs) };

  if (!mvu?.enabled) {
    errors.push({ field: "mvu", severity: "error", message: "EJS 依赖 MVU，启用 EJS 前必须启用 MVU" });
  }
  ejs.variable_paths.forEach((path, index) => {
    if (!path.startsWith("stat_data")) errors.push({ field: `variable_paths.${index}`, severity: "error", message: "EJS 变量路径必须以 stat_data 开头" });
  });
  if (ejs.entries.length === 0) errors.push({ field: "entries", severity: "error", message: "EJS entries 不能为空" });
  if (!ejs.entries.some((entry) => entry.role === "controller" || entry.role === "inline")) {
    errors.push({ field: "entries", severity: "error", message: "EJS 至少需要一个 controller 或 inline 条目" });
  }

  const names = new Set(ejs.entries.map((entry) => entry.name));
  ejs.entries.forEach((entry, index) => {
    if (!entry.name.trim()) errors.push({ field: `entries.${index}.name`, severity: "error", message: "EJS entry name 不能为空" });
    if (!entry.content.trim()) errors.push({ field: `entries.${index}.content`, severity: "error", message: "EJS entry content 不能为空" });
    if (entry.content.includes("<%") && !entry.content.includes("%>")) errors.push({ field: `entries.${index}.content`, severity: "error", message: "EJS 标签未闭合：缺少 %>" });
    if (/\b(?:const|let)\s+\w+\s*=\s*getvar\(/.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "读取阶段变量建议使用 var + typeof 防重复声明" });
    if (/getvar\(/.test(entry.content) && !/typeof\s+\w+\s*===\s*['"]undefined['"]/.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "读取变量建议使用 typeof 防重复声明" });
    if (/getvar\(/.test(entry.content) && !/\bvar\s+\w+\s*=\s*getvar\(/.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "读取变量建议使用 var 声明，避免 const/let 重复声明" });
    if (/getwi\(/.test(entry.content) && !/await\s+getwi\(/.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "getwi 调用建议使用 await getwi(...)" });
    if (/@preprocessing/.test(entry.content) && /@(generate_before|generate_after)/i.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "@preprocessing 不应与 @generate_before/@generate_after 同时使用" });
    if (/==(?!=)/.test(entry.content)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: "字符串/状态比较建议使用 === 或 !==" });
    if (entry.role === "controller") {
      if (!entry.enabled) warnings.push({ field: `entries.${index}.enabled`, severity: "warning", message: "controller 条目建议 enabled=true" });
      if (!entry.constant) warnings.push({ field: `entries.${index}.constant`, severity: "warning", message: "controller 条目建议 constant=true" });
    }
    if (entry.role === "stage" && entry.enabled) warnings.push({ field: `entries.${index}.enabled`, severity: "warning", message: "被 getwi 加载的 stage 条目建议 enabled=false" });
    for (const ref of extractGetwiRefs(entry.content)) {
      if (!names.has(ref)) warnings.push({ field: `entries.${index}.content`, severity: "warning", message: `getwi 引用的条目不存在：${ref}` });
    }
  });

  return { valid: errors.length === 0, errors, warnings, summary: summary(ejs) };
}

function extractGetwiRefs(content: string): string[] {
  return [...content.matchAll(/getwi\(['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function summary(ejs: EjsConfig): EjsValidationResult["summary"] {
  return { enabled: ejs.enabled, template_type: ejs.template_type, entry_count: ejs.entries.length, variable_path_count: ejs.variable_paths.length };
}
