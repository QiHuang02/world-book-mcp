import type { MvuConfig } from "../schemas/mvu.js";
import { issue, type ValidationIssue } from "./validation-types.js";

export interface MvuVariablePath {
  path: string;
  segments: string[];
  kind: "string" | "number" | "boolean" | "enum" | "record" | "object" | "custom";
  expression: string;
  has_default: boolean;
  default_value?: unknown;
  enum_values?: string[];
  readonly: boolean;
  hidden: boolean;
}

export interface MvuPathAnalysis {
  schema_paths: MvuVariablePath[];
  initvar_paths: string[];
  update_rule_paths: string[];
  readonly_paths: string[];
  hidden_paths: string[];
  parse_warnings: ValidationIssue[];
}

export function analyzeMvuPaths(mvu: Pick<MvuConfig, "schema_script" | "initvar" | "update_rules">): MvuPathAnalysis {
  const parse_warnings: ValidationIssue[] = [];
  const schema_paths = parseSchemaPaths(mvu.schema_script, parse_warnings);
  const initvar_paths = parseYamlLeafPaths(mvu.initvar, "initvar", parse_warnings);
  const update_rule_paths = parseUpdateRulePaths(mvu.update_rules, parse_warnings);
  return {
    schema_paths,
    initvar_paths,
    update_rule_paths,
    readonly_paths: schema_paths.filter((item) => item.readonly).map((item) => item.path),
    hidden_paths: schema_paths.filter((item) => item.hidden).map((item) => item.path),
    parse_warnings,
  };
}

export function toUiPath(path: string): string {
  return path === "stat_data" || path.startsWith("stat_data.") ? path : `stat_data.${path}`;
}

function fromUiPath(path: string): string {
  return path.startsWith("stat_data.") ? path.slice("stat_data.".length) : path;
}

export function normalizePath(path: string): string {
  return fromUiPath(path).replace(/^\/+/, "").replace(/^stat_data\//, "").replace(/\//g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
}

function parseSchemaPaths(script: string, warnings: ValidationIssue[]): MvuVariablePath[] {
  const body = extractSchemaObjectBody(script, warnings);
  if (!body) return [];
  return flattenObjectBody(body, [], warnings);
}

function extractSchemaObjectBody(script: string, warnings: ValidationIssue[]): string | undefined {
  const marker = /export\s+const\s+Schema\s*=\s*z\.object\s*\(/g.exec(script);
  if (!marker) {
    if (script.trim()) warnings.push(issue({ code: "mvu.schema.missing_schema_object", field: "schema_script", severity: "warning", message: "未能解析 export const Schema = z.object(...) 中的变量路径" }));
    return undefined;
  }
  const objectStart = script.indexOf("{", marker.index + marker[0].length);
  if (objectStart < 0) {
    warnings.push(issue({ code: "mvu.schema.missing_object_literal", field: "schema_script", severity: "warning", message: "Schema z.object(...) 中未找到对象字面量" }));
    return undefined;
  }
  const objectEnd = findMatching(script, objectStart, "{", "}");
  if (objectEnd < 0) {
    warnings.push(issue({ code: "mvu.schema.unmatched_brace", field: "schema_script", severity: "warning", message: "Schema 对象括号不匹配，无法完整解析变量路径" }));
    return undefined;
  }
  return script.slice(objectStart + 1, objectEnd);
}

function flattenObjectBody(body: string, prefix: string[], warnings: ValidationIssue[]): MvuVariablePath[] {
  const variables: MvuVariablePath[] = [];
  for (const entry of splitTopLevel(body, ",")) {
    const parsed = parseProperty(entry);
    if (!parsed) {
      if (entry.trim()) warnings.push(issue({ code: "mvu.schema.unparsed_entry", field: "schema_script", severity: "warning", message: `跳过无法解析的变量定义：${entry.trim().slice(0, 80)}` }));
      continue;
    }
    const path = [...prefix, parsed.key];
    const expression = parsed.value.trim();
    const nested = extractDirectObjectExpressionBody(expression);
    if (nested) variables.push(...flattenObjectBody(nested, path, warnings));
    else variables.push({
      path: path.join("."),
      segments: path,
      kind: inferKind(expression),
      expression,
      has_default: /\.(?:prefault|default)\s*\(/.test(expression),
      default_value: extractDefault(expression),
      enum_values: extractEnumValues(expression),
      readonly: path.at(-1)?.startsWith("_") ?? false,
      hidden: path.at(-1)?.startsWith("$") ?? false,
    });
  }
  return variables;
}

function parseYamlLeafPaths(value: string, field: string, warnings: ValidationIssue[]): string[] {
  if (!value.trim()) return [];
  const stack: Array<{ indent: number; key: string }> = [];
  const paths = new Set<string>();
  for (const [lineIndex, rawLine] of value.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/#.*$/, "");
    if (!line.trim() || /^\s*-\s/.test(line)) continue;
    const match = /^(\s*)([^:\n]+):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      if (/^\s*[^\s].+/.test(line)) warnings.push(issue({ code: "mvu.yaml.unparsed_line", field, severity: "warning", message: `${field} 第 ${lineIndex + 1} 行无法按 YAML key: value 解析` }));
      continue;
    }
    const indent = match[1].replace(/\t/g, "  ").length;
    const key = stripYamlKey(match[2].trim());
    const rest = match[3] ?? "";
    while (stack.length > 0 && stack.at(-1)!.indent >= indent) stack.pop();
    const currentPath = [...stack.map((item) => item.key), key];
    if (rest.trim() !== "" || looksNextLineNotChild(value, lineIndex, indent)) paths.add(currentPath.join("."));
    stack.push({ indent, key });
  }
  return [...paths].filter((path) => !["变量更新规则"].includes(path)).map(normalizePath);
}

function looksNextLineNotChild(value: string, lineIndex: number, indent: number): boolean {
  const lines = value.split(/\r?\n/);
  const next = lines.slice(lineIndex + 1).find((line) => line.trim() && !line.trim().startsWith("#"));
  if (!next) return true;
  const nextIndent = /^\s*/.exec(next)?.[0].replace(/\t/g, "  ").length ?? 0;
  return nextIndent <= indent;
}

function parseUpdateRulePaths(value: string, warnings: ValidationIssue[]): string[] {
  const yamlPaths = parseYamlLeafPaths(value.replace(/^\s*变量更新规则\s*:\s*$/m, ""), "update_rules", warnings)
    .map((path) => path.replace(/\.(?:type|range|check)$/, ""));
  const pointerPaths = [...value.matchAll(/(?:^|\s)(?:op\s*:\s*\w+[\s\S]{0,120}?path\s*:\s*|path\s*:\s*)(\/?(?:stat_data\/)?[^\s\n]+)/g)]
    .map((match) => normalizePath(match[1]));
  return [...new Set([...yamlPaths, ...pointerPaths])].filter(Boolean);
}

function parseProperty(entry: string): { key: string; value: string } | undefined {
  const trimmed = entry.trim();
  if (!trimmed) return undefined;
  const colon = findTopLevelColon(trimmed);
  if (colon < 0) return undefined;
  const key = parseKey(trimmed.slice(0, colon).trim());
  const value = trimmed.slice(colon + 1).trim().replace(/,$/, "");
  return key && value ? { key, value } : undefined;
}

function findTopLevelColon(value: string): number {
  let quote: string | undefined;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "{" || char === "[") stack.push(char);
    else if (char === ")" || char === "}" || char === "]") stack.pop();
    else if (char === ":" && stack.length === 0) return i;
  }
  return -1;
}

function parseKey(rawKey: string): string | undefined {
  if (/^[A-Za-z_$\p{L}][\p{L}\p{N}_$]*$/u.test(rawKey)) return rawKey;
  if ((rawKey.startsWith("\"") && rawKey.endsWith("\"")) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) return rawKey.slice(1, -1);
  if (!/[\s{}()[\],]/.test(rawKey)) return rawKey;
  return undefined;
}

function stripYamlKey(key: string): string {
  return ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))) ? key.slice(1, -1) : key;
}

function extractDirectObjectExpressionBody(expression: string): string | undefined {
  const trimmed = expression.trim();
  const match = /^z\.object\s*\(/.exec(trimmed);
  if (!match) return undefined;
  const objectStart = trimmed.indexOf("{", match.index + match[0].length);
  if (objectStart < 0) return undefined;
  const objectEnd = findMatching(trimmed, objectStart, "{", "}");
  if (objectEnd < 0) return undefined;
  const after = trimmed.slice(objectEnd + 1).trim();
  return /^\)\s*$/.test(after) ? trimmed.slice(objectStart + 1, objectEnd) : undefined;
}

function splitTopLevel(value: string, separator: string): string[] {
  const result: string[] = [];
  let start = 0;
  let quote: string | undefined;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "(" || char === "{" || char === "[") stack.push(char);
    else if (char === ")" || char === "}" || char === "]") stack.pop();
    else if (char === separator && stack.length === 0) { result.push(value.slice(start, i)); start = i + 1; }
  }
  result.push(value.slice(start));
  return result;
}

function findMatching(value: string, start: number, open: string, close: string): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let i = start; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function inferKind(expression: string): MvuVariablePath["kind"] {
  if (/z\.coerce\.number|z\.number/.test(expression)) return "number";
  if (/z\.boolean/.test(expression)) return "boolean";
  if (/z\.enum/.test(expression)) return "enum";
  if (/z\.(?:record|partialRecord)/.test(expression)) return "record";
  if (/z\.object/.test(expression)) return "object";
  return /z\./.test(expression) ? "string" : "custom";
}

function extractDefault(expression: string): unknown {
  const match = expression.match(/\.(?:prefault|default)\s*\(([^)]*)\)/);
  if (!match) return undefined;
  const trimmed = match[1].trim();
  try { return JSON.parse(trimmed); } catch { /* ignore */ }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed.replace(/^['\"]|['\"]$/g, "");
}

function extractEnumValues(expression: string): string[] | undefined {
  const match = expression.match(/z\.enum\s*\(\s*(\[[^\]]*\])/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1].replace(/'/g, "\""));
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch { return undefined; }
}
