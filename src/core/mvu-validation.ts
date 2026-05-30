import vm from "node:vm";
import path from "node:path";
import { z } from "zod";
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

type SchemaLeaf = { type: "string" | "number" | "boolean" | "enum" | "unknown"; optional: boolean; enumValues?: string[] };

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

    let schemaText = "";
    let schemaLeaves: Record<string, SchemaLeaf> = {};
    if (paths.schema) {
      schemaText = await readTextFile(paths.schema).catch(() => "");
      lintZodSchemaText(schemaText, issues);
      if (!/export\s+const\s+Schema\s*=\s*z\.object\s*\(/.test(schemaText)) {
        issues.push(issue("error", "mvu.schema.missing_export", "schema.js 应包含 export const Schema = z.object(...)", "mvu.schema"));
      } else {
        schemaLeaves = parseZodObjectSchema(schemaText);
        if (Object.keys(schemaLeaves).length === 0) {
          issues.push(issue("info", "mvu.schema.static_parse_empty", "静态解析未识别到 Schema 字段；复杂 schema 可能需要人工确认", "mvu.schema"));
        }
      }
    }

    let initvar: Record<string, unknown> = {};
    let initvarParsed = false;
    let initvarLeafValues: Record<string, unknown> = {};
    if (paths.initvar) {
      const initvarText = await readTextFile(paths.initvar).catch(() => "");
      try {
        initvar = parseYaml<Record<string, unknown>>(initvarText) ?? {};
        initvarParsed = true;
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
    if (schemaText && initvarParsed) validateSchemaRuntime(schemaText, initvar, issues);

    const initvarLeafPaths = Object.keys(initvarLeafValues);
    if (!mvu.variableListPath) issues.push(issue("warning", "mvu.variable_list_path.empty", "variableListPath 为空，默认建议为 stat_data", "mvu.variableListPath"));
    let variableListText = "";
    if (paths.variableList) {
      variableListText = await readTextFile(paths.variableList).catch(() => "");
      if (!variableListText.trim()) issues.push(issue("warning", "mvu.variable_list.empty", "variable-list.md 为空", "mvu.variableList"));
      const basePath = mvu.variableListPath ?? "stat_data";
      if (basePath && variableListText.includes("{{stat_data.")) issues.push(issue("warning", "mvu.variable_list.raw_macro", "变量列表通常不应写裸 {{stat_data.xxx}} 宏", "mvu.variableList"));
      for (const leaf of initvarLeafPaths) {
        const fullPath = basePath ? `${basePath}.${leaf.replace(/^stat_data\./, "")}` : leaf;
        if (variableListText.trim() && !variableListText.includes(leaf) && !variableListText.includes(fullPath)) issues.push(issue("warning", "mvu.variable_list.missing_variable", `variable-list.md 未提及 initvar 变量: ${fullPath}`, "mvu.variableList"));
      }
    }
    if (paths.outputFormat) {
      const outputFormat = await readTextFile(paths.outputFormat).catch(() => "");
      for (const leaf of initvarLeafPaths) {
        if (outputFormat.trim() && !outputFormat.includes(leaf)) issues.push(issue("warning", "mvu.output_format.missing_variable", `output-format.md 未提及 initvar 变量: ${leaf}`, "mvu.outputFormat"));
      }
    }
    let updateRulesText = "";
    if (paths.updateRules) {
      updateRulesText = await readTextFile(paths.updateRules).catch(() => "");
      validateReadonlyUpdateRules(updateRulesText, initvarLeafPaths, issues);
    }
  }
  const summary = summarize(issues);
  return { ok: summary.errors === 0, project_id: project.id, summary, issues, paths };
}

function lintZodSchemaText(schema: string, issues: MvuValidationIssue[]): void {
  if (/^\s*import\s+.*(?:zod|lodash|from\s+['"]zod['"]|from\s+['"]lodash['"])/m.test(schema)) issues.push(issue("warning", "mvu.schema.import_forbidden", "schema.js 运行时已提供 z 和 _，不应导入 zod/lodash", "mvu.schema"));
  if (/\.strict\s*\(/.test(schema)) issues.push(issue("warning", "mvu.schema.strict_forbidden", "Zod 4 运行时规则不使用 .strict()", "mvu.schema"));
  if (/\.passthrough\s*\(/.test(schema)) issues.push(issue("warning", "mvu.schema.passthrough_forbidden", "Zod 4 运行时规则不使用 .passthrough()", "mvu.schema"));
  if (/z\.number\s*\(/.test(schema)) issues.push(issue("warning", "mvu.schema.prefer_coerce_number", "数字变量建议使用 z.coerce.number()，以兼容 AI 输出字符串数字", "mvu.schema"));
  if (/\.transform\s*\(\s*\([^)]*,\s*[^)]*\)\s*=>/.test(schema)) issues.push(issue("warning", "mvu.schema.transform_context", "transform 回调只应接收已解析值，不要使用 context 参数", "mvu.schema"));
  if (/['"][^'"]*\{\{user\}\}[^'"]*['"]\s*:/.test(schema)) issues.push(issue("warning", "mvu.schema.user_macro_key", "schema 对象 key 不应使用 {{user}} 宏，建议使用固定标识如 主角/玩家", "mvu.schema"));
}

function validateSchemaRuntime(schemaText: string, initvar: Record<string, unknown>, issues: MvuValidationIssue[]): void {
  let schema: unknown;
  try {
    schema = loadSchemaFromSandbox(schemaText);
  } catch (error) {
    issues.push(issue("error", "mvu.schema.runtime_load_failed", `schema.js 沙箱执行失败: ${messageOf(error)}`, "mvu.schema"));
    return;
  }
  if (!isZodLikeSchema(schema)) {
    issues.push(issue("error", "mvu.schema.runtime_missing_schema", "schema.js 沙箱执行后未得到可用 Schema", "mvu.schema"));
    return;
  }
  let parsed: unknown;
  try {
    parsed = schema.parse(initvar);
  } catch (error) {
    issues.push(issue("error", "mvu.schema.parse_failed", `Schema.parse(initvar) 失败: ${formatZodError(error)}`, "mvu.initvar"));
    return;
  }
  try {
    const reparsed = schema.parse(parsed);
    if (stableStringify(parsed) !== stableStringify(reparsed)) {
      issues.push(issue("warning", "mvu.schema.non_idempotent", "Schema.parse(Schema.parse(initvar)) 与首次 parse 结果不同，transform 可能非幂等", "mvu.schema"));
    }
  } catch (error) {
    issues.push(issue("warning", "mvu.schema.reparse_failed", `Schema.parse(Schema.parse(initvar)) 失败: ${formatZodError(error)}`, "mvu.schema"));
  }
}

function loadSchemaFromSandbox(schemaText: string): unknown {
  const sanitized = schemaText
    .split(/\r?\n/)
    .filter((line) => !/^\s*import\b/.test(line) && !/^\s*export\s+type\b/.test(line))
    .join("\n")
    .replace(/\bexport\s+const\s+Schema\s*=/, "const Schema =")
    .replace(/\bexport\s+let\s+Schema\s*=/, "let Schema =")
    .replace(/\bexport\s+var\s+Schema\s*=/, "var Schema =");
  const sandbox = vm.createContext({
    z,
    _: { clamp: (value: unknown, min = -Infinity, max = Infinity) => Math.min(Math.max(Number(value), min), max) },
    Schema: undefined,
  }, { codeGeneration: { strings: false, wasm: false } });
  const script = new vm.Script(`${sanitized}\n;globalThis.__schema = Schema;`);
  script.runInContext(sandbox, { timeout: 1000 });
  return (sandbox as { __schema?: unknown }).__schema;
}

function isZodLikeSchema(value: unknown): value is { parse: (input: unknown) => unknown } {
  return isRecord(value) && typeof value.parse === "function";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function formatZodError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((item) => `${item.path.join(".") || "<root>"}: ${item.message}`).join("; ");
  return messageOf(error);
}

function validateReadonlyUpdateRules(updateRules: string, initvarLeafPaths: string[], issues: MvuValidationIssue[]): void {
  if (!updateRules.trim()) return;
  for (const leaf of initvarLeafPaths) {
    const segments = leaf.split(".");
    if (!segments.some((segment) => segment.startsWith("_") || segment.startsWith("$"))) continue;
    if (updateRules.includes(leaf) || segments.some((segment) => updateRules.includes(segment))) {
      issues.push(issue("warning", "mvu.update_rules.readonly_variable", `更新规则不应包含 _/$ 特殊变量: ${leaf}`, "mvu.updateRules"));
    }
  }
}

function compareSchemaAndInitvar(schemaLeaves: Record<string, SchemaLeaf>, initvarLeaves: Record<string, unknown>, issues: MvuValidationIssue[]): void {
  for (const [schemaPath, schemaLeaf] of Object.entries(schemaLeaves)) {
    const value = initvarLeaves[schemaPath];
    if (value === undefined) {
      if (!schemaLeaf.optional) issues.push(issue("error", "mvu.initvar.schema_required_missing", `initvar 缺少 schema 必填变量: ${schemaPath}`, "mvu.initvar"));
      continue;
    }
    const actualType = yamlValueType(value);
    const expectedType = schemaLeaf.type === "enum" ? "string" : schemaLeaf.type;
    if (expectedType !== "unknown" && actualType !== expectedType) {
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
    result[pathKey] = { type: zodPrimitiveType(expr), optional: isOptionalZod(expr), enumValues: zodEnumValues(expr) };
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
  return findMatchingPair(source, openIndex, "{", "}");
}

function findMatchingBracket(source: string, openIndex: number): number {
  return findMatchingPair(source, openIndex, "[", "]");
}

function findMatchingPair(source: string, openIndex: number, openChar: string, closeChar: string): number {
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
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function zodPrimitiveType(expr: string): SchemaLeaf["type"] {
  if (/z\.string\s*\(/.test(expr)) return "string";
  if (/z\.(?:coerce\.)?number\s*\(/.test(expr)) return "number";
  if (/z\.boolean\s*\(/.test(expr)) return "boolean";
  if (/z\.enum\s*\(/.test(expr)) return "enum";
  return "unknown";
}

function zodEnumValues(expr: string): string[] | undefined {
  const enumStart = expr.search(/z\.enum\s*\(/);
  if (enumStart === -1) return undefined;
  const openBracket = expr.indexOf("[", enumStart);
  if (openBracket === -1) return undefined;
  const closeBracket = findMatchingBracket(expr, openBracket);
  if (closeBracket === -1) return undefined;
  const values = splitTopLevelProperties(expr.slice(openBracket + 1, closeBracket))
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return values.length ? values : undefined;
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

function yamlValueType(value: unknown): "string" | "number" | "boolean" | "enum" | "unknown" {
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
