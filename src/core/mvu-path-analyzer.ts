import { normalizeIssue, type ValidationIssue } from "./validation-types.js";

export interface MvuSchemaPath { path: string; segments: string[]; expression: string; kind: "string" | "number" | "boolean" | "enum" | "record" | "object" | "custom"; defaultValue?: unknown; enumValues?: string[]; readonly: boolean; hidden: boolean }
export interface MvuPathAnalysis { schemaPaths: MvuSchemaPath[]; initvarPaths: string[]; updateRulePaths: string[]; readonlyPaths: string[]; hiddenPaths: string[]; parseWarnings: ValidationIssue[] }

export function toUiPath(path: string, root = "stat_data"): string { const normalized = normalizePath(path); return normalized ? `${root}.${normalized}` : root; }
export function fromUiPath(path: string, root = "stat_data"): string { const normalized = path.replace(/[\/]+/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, ""); return normalized === root ? "" : normalized.startsWith(`${root}.`) ? normalized.slice(root.length + 1) : normalized; }
export function normalizePath(path: string): string {
  const normalized = path.replace(/\[(\d+)\]/g, ".$1").replace(/[\/]+/g, ".").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
  return normalized === "stat_data" ? "" : normalized.startsWith("stat_data.") ? normalized.slice("stat_data.".length) : normalized;
}

export function analyzeMvuPaths(config: { schemaScript?: string; initvar?: string; updateRules?: string }): MvuPathAnalysis {
  const schemaScript = config.schemaScript ?? "";
  const initvar = config.initvar ?? "";
  const updateRules = config.updateRules ?? "";
  const parseWarnings: ValidationIssue[] = [];
  const schemaPaths = parseSchemaPaths(schemaScript, parseWarnings);
  const initvarPaths = parseYamlLeafPaths(initvar);
  const updateRulePaths = parseUpdateRulePaths(updateRules);
  return { schemaPaths, initvarPaths, updateRulePaths, readonlyPaths: schemaPaths.filter((item) => item.readonly).map((item) => item.path), hiddenPaths: schemaPaths.filter((item) => item.hidden).map((item) => item.path), parseWarnings };
}

function parseSchemaPaths(script: string, warnings: ValidationIssue[]): MvuSchemaPath[] {
  const marker = /export\s+const\s+Schema\s*=\s*z\.object\s*\(/.exec(script);
  if (!marker) { warnings.push(normalizeIssue({ code: "mvu.schema.missing_schema_object", field: "schemaScript", severity: "warning", message: "未找到 export const Schema = z.object(...)" })); return []; }
  const start = script.indexOf("{", marker.index);
  const end = findMatching(script, start, "{", "}");
  if (start < 0 || end < 0) { warnings.push(normalizeIssue({ code: "mvu.schema.parse_failed", field: "schemaScript", severity: "warning", message: "无法解析 Schema z.object(...) 内容" })); return []; }
  return parseObjectBody(script.slice(start + 1, end), []);
}

function parseObjectBody(body: string, prefix: string[]): MvuSchemaPath[] {
  const result: MvuSchemaPath[] = [];
  for (const part of splitTopLevel(body, ",")) {
    const [keyRaw, exprRaw] = splitKeyExpr(part);
    if (!keyRaw || !exprRaw) continue;
    const key = unquote(keyRaw.trim());
    const expr = exprRaw.trim();
    const objectStart = expr.indexOf("z.object");
    if (objectStart >= 0 && !/^z\.object\s*\(\s*\{\s*\}\s*\)\s*\./.test(expr)) {
      const brace = expr.indexOf("{", objectStart);
      const end = findMatching(expr, brace, "{", "}");
      if (brace >= 0 && end >= 0) { result.push(...parseObjectBody(expr.slice(brace + 1, end), [...prefix, key])); continue; }
    }
    const segments = [...prefix, key];
    const defaultValue = inferDefault(expr);
    result.push({ path: segments.join("."), segments, expression: expr, kind: inferKind(expr), defaultValue, enumValues: inferEnum(expr), readonly: key.startsWith("_"), hidden: key.startsWith("$") });
  }
  return result;
}

function splitKeyExpr(part: string): [string, string] | [] {
  const index = findTopLevelColon(part);
  if (index < 0) return [];
  return [part.slice(0, index), part.slice(index + 1)];
}

function findTopLevelColon(text: string): number {
  let quote = ""; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === ":" && depth === 0) return i;
  }
  return -1;
}

function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = []; let start = 0; let quote = ""; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === delimiter && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function findMatching(text: string, start: number, open: string, close: string): number {
  if (start < 0) return -1;
  let depth = 0; let quote = "";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    if (ch === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function inferKind(expr: string): MvuSchemaPath["kind"] { if (/z\.coerce\.number|z\.number/.test(expr)) return "number"; if (/z\.boolean/.test(expr)) return "boolean"; if (/z\.enum/.test(expr)) return "enum"; if (/z\.record/.test(expr)) return "record"; if (/z\.object/.test(expr)) return "object"; if (/z\.string/.test(expr)) return "string"; return "custom"; }
function inferDefault(expr: string): unknown { const match = expr.match(/\.prefault\s*\(([^)]*)\)/); if (!match) return undefined; const text = match[1].trim(); try { return Function(`"use strict"; return (${text});`)(); } catch { return text.replace(/^['"]|['"]$/g, ""); } }
function inferEnum(expr: string): string[] | undefined { const match = expr.match(/z\.enum\s*\((\[[\s\S]*?\])\)/); if (!match) return undefined; try { const parsed = JSON.parse(match[1].replace(/'/g, '"')); return Array.isArray(parsed) ? parsed.map(String) : undefined; } catch { return undefined; } }
function unquote(value: string): string { return value.replace(/^['"`]|['"`]$/g, ""); }

function parseYamlLeafPaths(text: string): string[] { const paths: string[] = []; const stack: Array<{ indent: number; key: string }> = []; for (const raw of text.split(/\r?\n/)) { if (!raw.trim() || /^\s*#/.test(raw)) continue; const match = raw.match(/^(\s*)([^:#][^:]*):\s*(.*)$/); if (!match) continue; const indent = match[1].length; const key = unquote(match[2].trim()); const value = match[3].trim(); while (stack.length && stack.at(-1)!.indent >= indent) stack.pop(); stack.push({ indent, key }); if (value !== "") paths.push(stack.map((item) => item.key).join(".")); } return paths; }
function parseUpdateRulePaths(text: string): string[] { return parseYamlLeafPaths(text).map((path) => path.replace(/^变量更新规则\./, "").replace(/\.(?:type|range|check)(?:\.\d+)?$/, "")).filter((path, index, array) => path && array.indexOf(path) === index); }
