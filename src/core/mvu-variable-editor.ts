import type { MvuConfig, MvuVariableDefinition } from "../schemas/mvu.js";

// 注意：本文件用一个手写的"括号/引号匹配"扫描器解析 z.object({...}) 字面量，
// 而不是真正的 JS AST 解析。它的设计前提是：schema_script 是由 mvu-template / upsertMvuVariable
// 这条工具链生成的标准模板。用户如果绕过工具直接 update_draft_field schema_script，
// 一旦写出工具不熟悉的 JS 表达式（嵌套三元、模板字符串中的 } 等），解析会退化为 warning，
// 后续 upsert/remove 仍然可用，但行为退化为"读不到原变量"。
// 如果未来要支持任意手写脚本，应当切换到真正的 JS parser（例如 acorn）。

export interface MvuVariableSummary {
  path: string[];
  expression: string;
  kind: MvuVariableDefinition["kind"];
  default_value?: unknown;
  min?: number;
  max?: number;
  enum_values?: string[];
  description?: string;
  readonly?: boolean;
  hidden?: boolean;
  update_rule?: string;
}

export interface MvuVariableListResult {
  variables: MvuVariableSummary[];
  warnings: string[];
}

export interface MvuVariableEditResult {
  mvu: MvuConfig;
  variables: MvuVariableSummary[];
  warnings: string[];
  changed_path?: string[];
  created?: boolean;
  removed?: boolean;
}

interface RewriteOptions {
  rewriteInitvar?: boolean;
  rewriteUpdateRules?: boolean;
}

const TEMPLATE_IMPORT = "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';";

export function listMvuVariables(mvu: Pick<MvuConfig, "schema_script" | "initvar" | "update_rules">): MvuVariableListResult {
  const warnings: string[] = [];
  const body = extractSchemaObjectBody(mvu.schema_script, warnings);
  if (!body) return { variables: [], warnings };
  const variables = flattenObjectBody(body, [], warnings).map((variable) => hydrateMetadata(variable, mvu));
  return { variables, warnings };
}

export function upsertMvuVariable(mvu: MvuConfig, variable: MvuVariableDefinition, options: RewriteOptions = {}): MvuVariableEditResult {
  const listed = listMvuVariables(mvu);
  const pathKey = keyOf(variable.path);
  const existingIndex = listed.variables.findIndex((item) => keyOf(item.path) === pathKey);
  const nextVariable = normalizeVariable(variable);
  const variables = existingIndex >= 0 ? listed.variables.map((item, index) => index === existingIndex ? nextVariable : item) : [...listed.variables, nextVariable];
  const rewritten = rewriteMvuVariables(mvu, variables, options);
  return { ...rewritten, changed_path: variable.path, created: existingIndex < 0 };
}

export function removeMvuVariable(mvu: MvuConfig, path: string[], options: RewriteOptions = {}): MvuVariableEditResult {
  const listed = listMvuVariables(mvu);
  const pathKey = keyOf(path);
  const variables = listed.variables.filter((item) => keyOf(item.path) !== pathKey);
  const rewritten = rewriteMvuVariables(mvu, variables, options);
  return { ...rewritten, changed_path: path, removed: variables.length !== listed.variables.length };
}

export function rewriteMvuVariables(mvu: MvuConfig, definitions: MvuVariableDefinition[], options: RewriteOptions = {}): MvuVariableEditResult {
  const warnings = validateVariables(definitions);
  const variables = mergeVariables(definitions.map(normalizeVariable));
  const schema_script = buildSchemaScript(variables);
  const rewriteInitvar = options.rewriteInitvar ?? true;
  const rewriteUpdateRules = options.rewriteUpdateRules ?? true;
  return {
    mvu: {
      ...mvu,
      schema_script,
      ...(rewriteInitvar ? { initvar: buildInitvar(variables) } : {}),
      ...(rewriteUpdateRules ? { update_rules: buildUpdateRules(variables) } : {}),
    },
    variables,
    warnings,
  };
}

function extractSchemaObjectBody(script: string, warnings: string[]): string | undefined {
  const marker = /export\s+const\s+Schema\s*=\s*z\.object\s*\(/g.exec(script);
  if (!marker) {
    warnings.push("未找到 export const Schema = z.object(...)；schema_script 由 mvu 工具管理，手动覆盖后请重新通过 upsert_mvu_variable / rewrite_mvu_variables 重建。");
    return undefined;
  }
  const objectStart = script.indexOf("{", marker.index + marker[0].length);
  if (objectStart < 0) {
    warnings.push("Schema z.object(...) 中未找到对象字面量；如果手动改过 schema_script，请改回工具生成的形态。");
    return undefined;
  }
  const objectEnd = findMatching(script, objectStart, "{", "}");
  if (objectEnd < 0) {
    warnings.push("Schema 对象括号不匹配；schema_script 由 mvu 工具管理，手动改写后只支持通过 rewrite_mvu_variables 重建，不支持局部修改。");
    return undefined;
  }
  return script.slice(objectStart + 1, objectEnd);
}

function flattenObjectBody(body: string, prefix: string[], warnings: string[]): MvuVariableSummary[] {
  const entries = splitTopLevel(body, ",");
  const variables: MvuVariableSummary[] = [];
  for (const entry of entries) {
    const parsed = parseProperty(entry);
    if (!parsed) {
      if (entry.trim()) warnings.push(`跳过无法解析的变量定义：${entry.trim().slice(0, 80)}`);
      continue;
    }
    const path = [...prefix, parsed.key];
    const expression = parsed.value.trim();
    const nested = extractDirectObjectExpressionBody(expression);
    if (nested) variables.push(...flattenObjectBody(nested, path, warnings));
    else variables.push({ path, expression, kind: inferKind(expression) });
  }
  return variables;
}

function parseProperty(entry: string): { key: string; value: string } | undefined {
  const trimmed = entry.trim();
  if (!trimmed) return undefined;
  const colon = findTopLevelColon(trimmed);
  if (colon < 0) return undefined;
  const rawKey = trimmed.slice(0, colon).trim();
  const value = trimmed.slice(colon + 1).trim().replace(/,$/, "");
  const key = parseKey(rawKey);
  if (!key || !value) return undefined;
  return { key, value };
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
  // 第一段（首字符）允许 ASCII 字母/数字下划线/$/Unicode 字母；后续允许 Unicode 字母/数字/_/$。
  if (/^[A-Za-z_$\p{L}][\p{L}\p{N}_$]*$/u.test(rawKey)) return rawKey;
  if ((rawKey.startsWith("\"") && rawKey.endsWith("\"")) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    try { return JSON.parse(rawKey.startsWith("'") ? JSON.stringify(rawKey.slice(1, -1)) : rawKey); }
    catch { return rawKey.slice(1, -1); }
  }
  if (!/[\s{}()[\],]/.test(rawKey)) return rawKey;
  return undefined;
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
  if (!/^\)\s*$/.test(after)) return undefined;
  return trimmed.slice(objectStart + 1, objectEnd);
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
    else if (char === separator && stack.length === 0) {
      result.push(value.slice(start, i));
      start = i + 1;
    }
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

function hydrateMetadata(variable: MvuVariableSummary, mvu: Pick<MvuConfig, "initvar" | "update_rules">): MvuVariableSummary {
  const expression = variable.expression;
  return {
    ...variable,
    default_value: extractDefault(expression) ?? readInitValue(mvu.initvar, variable.path),
    min: extractClamp(expression)?.min,
    max: extractClamp(expression)?.max,
    enum_values: extractEnumValues(expression),
    description: extractDescription(expression),
    readonly: variable.path.at(-1)?.startsWith("_"),
    hidden: variable.path.at(-1)?.startsWith("$"),
    update_rule: readUpdateRule(mvu.update_rules, variable.path),
  };
}

function normalizeVariable(definition: MvuVariableDefinition): MvuVariableSummary {
  const expression = definition.schema_expression ?? buildExpression(definition);
  assertSafeExpression(expression);
  return {
    path: definition.path,
    expression,
    kind: definition.kind ?? inferKind(expression),
    default_value: definition.default_value ?? extractDefault(expression),
    min: definition.min ?? extractClamp(expression)?.min,
    max: definition.max ?? extractClamp(expression)?.max,
    enum_values: definition.enum_values ?? extractEnumValues(expression),
    description: definition.description ?? extractDescription(expression),
    readonly: definition.readonly ?? definition.path.at(-1)?.startsWith("_"),
    hidden: definition.hidden ?? definition.path.at(-1)?.startsWith("$"),
    update_rule: definition.update_rule,
  };
}

function buildExpression(definition: MvuVariableDefinition): string {
  const description = definition.description ? `.describe(${JSON.stringify(definition.description)})` : "";
  const prefault = definition.default_value !== undefined ? `.prefault(${literal(definition.default_value)})` : "";
  switch (definition.kind) {
    case "number": {
      const min = definition.min ?? 0;
      const max = definition.max ?? 100;
      const defaultValue = definition.default_value ?? min;
      return `z.coerce.number()${description}.transform(v => _.clamp(v, ${min}, ${max})).prefault(${literal(defaultValue)})`;
    }
    case "boolean": return `z.boolean()${description}.prefault(${literal(definition.default_value ?? false)})`;
    case "enum": {
      const values = definition.enum_values ?? (typeof definition.default_value === "string" ? [definition.default_value] : []);
      if (values.length === 0) throw new Error("enum 变量必须提供 enum_values 或字符串 default_value");
      return `z.enum(${literal(values)})${description}.prefault(${literal(definition.default_value ?? values[0])})`;
    }
    case "record": return `z.record(z.string(), z.string())${description}${definition.default_value === undefined ? ".prefault({})" : prefault}`;
    case "object": return `z.object({})${description}${definition.default_value === undefined ? ".prefault({})" : prefault}`;
    case "custom": throw new Error("kind=custom 必须提供 schema_expression");
    case "string":
    default: return `z.string()${description}.prefault(${literal(definition.default_value ?? "")})`;
  }
}

function assertSafeExpression(expression: string): void {
  const trimmed = expression.trim();
  if (!/^(?:z|z\.coerce)\./.test(trimmed)) throw new Error("schema_expression 必须以 z. 或 z.coerce. 开头");
  const forbidden = [/\bimport\b/, /\bexport\b/, /registerMvuSchema/, /getvar\s*\(/, /_\.(?:set|add)\s*\(/, /<script/i, /\.(?:optional|strict|passthrough)\s*\(/];
  const hit = forbidden.find((pattern) => pattern.test(trimmed));
  if (hit) throw new Error(`schema_expression 包含禁止片段：${hit}`);
}

function validateVariables(definitions: MvuVariableDefinition[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    const pathKey = keyOf(definition.path);
    if (seen.has(pathKey)) warnings.push(`重复变量路径 ${definition.path.join(".")}，将以后者覆盖。`);
    seen.add(pathKey);
  }
  return warnings;
}

function mergeVariables(variables: MvuVariableSummary[]): MvuVariableSummary[] {
  const map = new Map<string, MvuVariableSummary>();
  for (const variable of variables) map.set(keyOf(variable.path), variable);
  return Array.from(map.values()).sort((a, b) => keyOf(a.path).localeCompare(keyOf(b.path), "zh-Hans-CN"));
}

function buildSchemaScript(variables: MvuVariableSummary[]): string {
  return `${TEMPLATE_IMPORT}\n\nexport const Schema = z.object({\n${buildObjectFields(variables, 1)}\n});\n\n$(() => {\n  registerMvuSchema(Schema);\n});`;
}

function buildObjectFields(variables: MvuVariableSummary[], level: number): string {
  const grouped = new Map<string, MvuVariableSummary[]>();
  const leaves: MvuVariableSummary[] = [];
  for (const variable of variables) {
    if (variable.path.length === level) leaves.push(variable);
    else {
      const key = variable.path[level - 1];
      grouped.set(key, [...(grouped.get(key) ?? []), variable]);
    }
  }
  const lines: string[] = [];
  for (const [key, childVariables] of grouped) {
    lines.push(`${indent(level)}${propertyKey(key)}: z.object({\n${buildObjectFields(childVariables, level + 1)}\n${indent(level)}})`);
  }
  for (const leaf of leaves) lines.push(`${indent(level)}${propertyKey(leaf.path.at(-1) ?? "变量")}: ${leaf.expression}`);
  return lines.map((line, index) => `${line}${index === lines.length - 1 ? "" : ","}`).join("\n");
}

function buildInitvar(variables: MvuVariableSummary[]): string {
  const root: Record<string, unknown> = {};
  for (const variable of variables) setNested(root, variable.path, variable.default_value ?? defaultForKind(variable.kind));
  return yamlLines(root).join("\n");
}

function buildUpdateRules(variables: MvuVariableSummary[]): string {
  const editable = variables.filter((variable) => !variable.readonly && !variable.path.at(-1)?.startsWith("_"));
  const lines = ["变量更新规则:"];
  const root: Record<string, unknown> = {};
  for (const variable of editable) {
    setNested(root, variable.path, {
      type: variable.kind,
      ...(variable.kind === "number" && variable.min !== undefined && variable.max !== undefined ? { range: `${variable.min}~${variable.max}` } : {}),
      check: [variable.update_rule?.trim() || defaultRule(variable)],
    });
  }
  lines.push(...yamlLines(root, 1));
  return lines.join("\n");
}

function setNested(target: Record<string, unknown>, path: string[], value: unknown): void {
  let current = target;
  for (const [index, key] of path.entries()) {
    if (index === path.length - 1) current[key] = value;
    else {
      const next = current[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) current[key] = {};
      current = current[key] as Record<string, unknown>;
    }
  }
}

function yamlLines(value: Record<string, unknown>, level = 0): string[] {
  const lines: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      lines.push(`${"  ".repeat(level)}${key}:`);
      lines.push(...yamlLines(child as Record<string, unknown>, level + 1));
    } else if (Array.isArray(child)) {
      lines.push(`${"  ".repeat(level)}${key}:`);
      for (const item of child) lines.push(`${"  ".repeat(level + 1)}- ${String(item)}`);
    } else {
      lines.push(`${"  ".repeat(level)}${key}: ${String(child ?? "")}`);
    }
  }
  return lines;
}

function readInitValue(initvar: string, path: string[]): unknown {
  const line = initvar.split(/\r?\n/).find((item) => item.trim().startsWith(`${path.at(-1)}:`));
  return line?.split(":").slice(1).join(":").trim() || undefined;
}

function readUpdateRule(updateRules: string, path: string[]): string | undefined {
  const leaf = path.at(-1);
  if (!leaf || !updateRules.includes(`${leaf}:`)) return undefined;
  const match = updateRules.match(new RegExp(`${escapeRegExp(leaf)}:[\\s\\S]{0,240}?-\\s*([^\\n]+)`));
  return match?.[1]?.trim();
}

function inferKind(expression: string): MvuVariableDefinition["kind"] {
  if (/z\.coerce\.number|z\.number/.test(expression)) return "number";
  if (/z\.boolean/.test(expression)) return "boolean";
  if (/z\.enum/.test(expression)) return "enum";
  if (/z\.record|z\.partialRecord/.test(expression)) return "record";
  if (/z\.object/.test(expression)) return "object";
  return "string";
}

function extractDefault(expression: string): unknown {
  const match = expression.match(/\.prefault\s*\(([^)]*)\)/);
  if (!match) return undefined;
  return parseLiteral(match[1].trim());
}

function extractClamp(expression: string): { min: number; max: number } | undefined {
  const match = expression.match(/_\.clamp\s*\(\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
  return match ? { min: Number(match[1]), max: Number(match[2]) } : undefined;
}

function extractEnumValues(expression: string): string[] | undefined {
  const match = expression.match(/z\.enum\s*\(\s*(\[[^\]]*\])/);
  if (!match) return undefined;
  const parsed = parseLiteral(match[1]);
  return Array.isArray(parsed) ? parsed.map(String) : undefined;
}

function extractDescription(expression: string): string | undefined {
  const match = expression.match(/\.describe\s*\(\s*(["'])(.*?)\1\s*\)/);
  return match?.[2];
}

function parseLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // JSON.parse 直接吃掉双引号字面量（含转义）。
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  // 单引号字面量手工还原转义（\', \\, \n, \r, \t, \" 等），再交给 JSON.parse。
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const decoded = decodeSingleQuotedString(trimmed.slice(1, -1));
    if (decoded !== undefined) {
      try { return JSON.parse(JSON.stringify(decoded)); } catch { /* fall through */ }
      return decoded;
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  // 兜底：原样返回（去掉成对外引号），保证调用方至少拿到字符串。
  if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith("\"") && trimmed.endsWith("\"")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function decodeSingleQuotedString(body: string): string | undefined {
  let result = "";
  let i = 0;
  while (i < body.length) {
    const char = body[i];
    if (char === "\\") {
      const next = body[i + 1];
      if (next === undefined) return undefined;
      switch (next) {
        case "n": result += "\n"; break;
        case "r": result += "\r"; break;
        case "t": result += "\t"; break;
        case "b": result += "\b"; break;
        case "f": result += "\f"; break;
        case "'": result += "'"; break;
        case "\"": result += "\""; break;
        case "\\": result += "\\"; break;
        case "/": result += "/"; break;
        default: result += next; break;
      }
      i += 2;
      continue;
    }
    if (char === "'") return undefined; // 不允许出现未转义的内嵌单引号
    result += char;
    i += 1;
  }
  return result;
}

function defaultForKind(kind: MvuVariableDefinition["kind"]): unknown {
  if (kind === "number") return 0;
  if (kind === "boolean") return false;
  if (kind === "record" || kind === "object") return {};
  return "";
}

function defaultRule(variable: MvuVariableSummary): string {
  if (variable.kind === "number") return "根据互动、承诺、冲突、照顾行为调整，单轮变化保持克制";
  return "根据当前场景、对话内容和关系变化更新为简短明确的值";
}

function propertyKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function literal(value: unknown): string {
  return JSON.stringify(value);
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function keyOf(path: string[]): string {
  return path.join("\u0000");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
