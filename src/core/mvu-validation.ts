import path from "node:path";
import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, readDraft } from "../storage/workspace.js";
import { resolveDraftReference } from "../storage/path-policy.js";
import { parseYaml, readTextFile } from "../utils/yaml.js";

export interface MvuValidationIssue { severity: "error" | "warning" | "info"; code: string; message: string; field?: string }
export interface MvuValidationReport {
  ok: boolean;
  project_id: string;
  summary: { errors: number; warnings: number; infos: number };
  issues: MvuValidationIssue[];
  paths: { schema?: string; initvar?: string; updateRules?: string; variableList?: string; outputFormat?: string };
}

type SchemaLeaf = { type: "string" | "number" | "boolean" | "unknown"; optional: boolean };

export async function validateMvuProject(project: Project): Promise<MvuValidationReport> {
  const issues: MvuValidationIssue[] = [];
  const paths: MvuValidationReport["paths"] = {};
  const draft = await readDraft(project).catch((error) => {
    issues.push(issue("error", "draft.read_failed", `读取 draft 失败: ${messageOf(error)}`));
    return undefined;
  });
  const mvu = draft?.assets?.mvu;
  if (!mvu?.enabled) issues.push(issue("info", "mvu.disabled", "MVU 未启用"));
  else {
    const assetsFile = draftPath(project, "assets");
    const required = { schema: mvu.schema, initvar: mvu.initvar, updateRules: mvu.updateRules, variableList: mvu.variableList, outputFormat: mvu.outputFormat } as const;
    for (const [field, ref] of Object.entries(required)) {
      if (!ref) {
        issues.push(issue("error", `mvu.${field}.missing`, `启用 MVU 时必须配置 ${field}`, `mvu.${field}`));
        continue;
      }
      try {
        const resolved = resolveDraftReference(projectDir(project.slug), assetsFile, ref);
        paths[field as keyof typeof paths] = resolved;
        await readTextFile(resolved);
      } catch (error) {
        issues.push(issue("error", `mvu.${field}.read_failed`, `读取 ${field} 失败: ${messageOf(error)}`, `mvu.${field}`));
      }
    }

    let schemaLeaves: Record<string, SchemaLeaf> = {};
    if (paths.schema) {
      const schema = await readTextFile(paths.schema).catch(() => "");
      if (!/export\s+const\s+Schema\s*=\s*z\.object\s*\(/.test(schema)) {
        issues.push(issue("error", "mvu.schema.missing_export", "schema.js 应包含 export const Schema = z.object(...)", "mvu.schema"));
      } else {
        schemaLeaves = parseZodObjectSchema(schema);
        if (Object.keys(schemaLeaves).length === 0) {
          issues.push(issue("info", "mvu.schema.static_parse_empty", "静态解析未识别到 Schema 字段；复杂 schema 可能需要人工确认", "mvu.schema"));
        }
      }
    }

    let initvar: Record<string, unknown> = {};
    let initvarLeafValues: Record<string, unknown> = {};
    if (paths.initvar) {
      const initvarText = await readTextFile(paths.initvar).catch(() => "");
      try {
        initvar = parseYaml<Record<string, unknown>>(initvarText) ?? {};
        if (isRecord(initvar) && Object.keys(initvar).length === 1 && isRecord(initvar.stat_data)) {
          issues.push(issue("warning", "mvu.initvar.stat_data_root", "initvar 可能多包了一层 stat_data 根键", "mvu.initvar"));
        }
        initvarLeafValues = flattenLeafValues(initvar);
        if (Object.keys(initvarLeafValues).length === 0) issues.push(issue("warning", "mvu.initvar.empty", "initvar 未声明任何叶子变量", "mvu.initvar"));
      } catch (error) {
        issues.push(issue("error", "mvu.initvar.invalid_yaml", `initvar YAML 无法解析: ${messageOf(error)}`, "mvu.initvar"));
      }
    }

    compareSchemaAndInitvar(schemaLeaves, initvarLeafValues, issues);

    const initvarLeafPaths = Object.keys(initvarLeafValues);
    if (!mvu.variableListPath) issues.push(issue("warning", "mvu.variable_list_path.empty", "variableListPath 为空，默认建议为 stat_data", "mvu.variableListPath"));
    if (paths.variableList) {
      const variableList = await readTextFile(paths.variableList).catch(() => "");
      if (!variableList.trim()) issues.push(issue("warning", "mvu.variable_list.empty", "variable-list.md 为空", "mvu.variableList"));
      const basePath = mvu.variableListPath ?? "stat_data";
      if (basePath && variableList.includes("{{stat_data.")) issues.push(issue("warning", "mvu.variable_list.raw_macro", "变量列表通常不应写裸 {{stat_data.xxx}} 宏", "mvu.variableList"));
      for (const leaf of initvarLeafPaths) {
        const fullPath = basePath ? `${basePath}.${leaf.replace(/^stat_data\./, "")}` : leaf;
        if (variableList.trim() && !variableList.includes(leaf) && !variableList.includes(fullPath)) issues.push(issue("warning", "mvu.variable_list.missing_variable", `variable-list.md 未提及 initvar 变量: ${fullPath}`, "mvu.variableList"));
      }
    }
    if (paths.outputFormat) {
      const outputFormat = await readTextFile(paths.outputFormat).catch(() => "");
      for (const leaf of initvarLeafPaths) {
        if (outputFormat.trim() && !outputFormat.includes(leaf)) issues.push(issue("warning", "mvu.output_format.missing_variable", `output-format.md 未提及 initvar 变量: ${leaf}`, "mvu.outputFormat"));
      }
    }
  }
  const summary = summarize(issues);
  return { ok: summary.errors === 0, project_id: project.id, summary, issues, paths };
}

function compareSchemaAndInitvar(schemaLeaves: Record<string, SchemaLeaf>, initvarLeaves: Record<string, unknown>, issues: MvuValidationIssue[]): void {
  for (const [schemaPath, schemaLeaf] of Object.entries(schemaLeaves)) {
    const value = initvarLeaves[schemaPath];
    if (value === undefined) {
      if (!schemaLeaf.optional) issues.push(issue("error", "mvu.initvar.schema_required_missing", `initvar 缺少 schema 必填变量: ${schemaPath}`, "mvu.initvar"));
      continue;
    }
    const actualType = yamlValueType(value);
    if (schemaLeaf.type !== "unknown" && actualType !== schemaLeaf.type) {
      issues.push(issue("error", "mvu.initvar.schema_type_mismatch", `initvar 变量 ${schemaPath} 类型为 ${actualType}，但 schema 期望 ${schemaLeaf.type}`, "mvu.initvar"));
    }
  }
  for (const initPath of Object.keys(initvarLeaves)) {
    if (Object.keys(schemaLeaves).length > 0 && !schemaLeaves[initPath]) issues.push(issue("warning", "mvu.initvar.schema_extra_variable", `initvar 变量未在 schema 中声明: ${initPath}`, "mvu.initvar"));
  }
}

function parseZodObjectSchema(source: string): Record<string, SchemaLeaf> {
  const start = source.search(/export\s+const\s+Schema\s*=\s*z\.object\s*\(/);
  if (start === -1) return {};
  const openParen = source.indexOf("(", start);
  const openBrace = source.indexOf("{", openParen);
  if (openBrace === -1) return {};
  const closeBrace = findMatchingBrace(source, openBrace);
  if (closeBrace === -1) return {};
  return parseObjectBody(source.slice(openBrace + 1, closeBrace));
}

function parseObjectBody(body: string, prefix = ""): Record<string, SchemaLeaf> {
  const result: Record<string, SchemaLeaf> = {};
  for (const property of splitTopLevelProperties(body)) {
    const colon = property.indexOf(":");
    if (colon === -1) continue;
    const rawKey = property.slice(0, colon).trim();
    const key = rawKey.replace(/^['"]|['"]$/g, "");
    const expr = property.slice(colon + 1).trim();
    const pathKey = prefix ? `${prefix}.${key}` : key;
    const nestedStart = expr.indexOf("z.object");
    if (nestedStart !== -1) {
      const brace = expr.indexOf("{", nestedStart);
      const end = brace === -1 ? -1 : findMatchingBrace(expr, brace);
      if (brace !== -1 && end !== -1) Object.assign(result, parseObjectBody(expr.slice(brace + 1, end), pathKey));
      else result[pathKey] = { type: "unknown", optional: isOptionalZod(expr) };
      continue;
    }
    result[pathKey] = { type: zodPrimitiveType(expr), optional: isOptionalZod(expr) };
  }
  return result;
}

function splitTopLevelProperties(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const previous = body[i - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{" || char === "(" || char === "[") depth += 1;
    else if (char === "}" || char === ")" || char === "]") depth -= 1;
    else if (char === "," && depth === 0) {
      const part = body.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  const tail = body.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const previous = source[i - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function zodPrimitiveType(expr: string): SchemaLeaf["type"] {
  if (/z\.string\s*\(/.test(expr)) return "string";
  if (/z\.number\s*\(/.test(expr)) return "number";
  if (/z\.boolean\s*\(/.test(expr)) return "boolean";
  return "unknown";
}

function isOptionalZod(expr: string): boolean {
  return /\.optional\s*\(|\.default\s*\(/.test(expr);
}

function flattenLeafValues(value: unknown, prefix = ""): Record<string, unknown> {
  if (!isRecord(value)) return prefix ? { [prefix]: value } : {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    Object.assign(result, flattenLeafValues(child, next));
  }
  return result;
}

function yamlValueType(value: unknown): "string" | "number" | "boolean" | "unknown" {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "unknown";
}

function summarize(issues: MvuValidationIssue[]): MvuValidationReport["summary"] {
  return { errors: issues.filter((item) => item.severity === "error").length, warnings: issues.filter((item) => item.severity === "warning").length, infos: issues.filter((item) => item.severity === "info").length };
}

function issue(severity: MvuValidationIssue["severity"], code: string, message: string, field?: string): MvuValidationIssue {
  return { severity, code, message, field };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
