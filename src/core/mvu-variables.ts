import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference, resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, stringifyYaml, writeTextFile } from "../utils/yaml.js";
import { MVU_DONE_BEAUTIFY_HTML, MVU_LOADING_BEAUTIFY_HTML } from "./mvu-templates.js";

export type MvuVariableKind = "string" | "number" | "boolean" | "enum" | "object" | "record" | "custom";
export interface MvuVariableInput {
  path: string[];
  kind?: MvuVariableKind;
  defaultValue?: unknown;
  description?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  hidden?: boolean;
  readonly?: boolean;
}
export interface MvuRewriteOptions { schema?: boolean; initvar?: boolean; variableList?: boolean; updateRules?: boolean; outputFormat?: boolean }
export interface MvuVariableRecord extends MvuVariableInput { dotPath: string; inVariableList: boolean; inOutputFormat: boolean }

const DEFAULT_REWRITE: Required<MvuRewriteOptions> = { schema: true, initvar: true, variableList: true, updateRules: true, outputFormat: true };
const MVU_REFS = { schema: "../source/mvu/schema.js", initvar: "../source/mvu/initvar.yaml", updateRules: "../source/mvu/update-rules.yaml", variableList: "../source/mvu/variable-list.md", outputFormat: "../source/mvu/output-format.md" };

export async function applyMvuPreset(project: Project, options: { preset: "minimal" | "nova" | "tavern_cards"; overwrite?: boolean }): Promise<{ ok: boolean; project_id: string; preset: string; files: string[]; next_actions: string[] }> {
  const files: string[] = [];
  const variables: Array<MvuVariableInput & { dotPath: string }> = [];
  const presetNote = options.preset === "nova" ? "# nova profile: initvar → update-rules → variable-list → output-format\n" : options.preset === "tavern_cards" ? "# tavern-cards profile: [InitVar] / [mvu_update] / [mvu_plot] prefixes\n" : "";
  const contents: Record<string, string> = {
    "mvu/schema.js": buildSchemaJs(variables),
    "mvu/initvar.yaml": "{}\n",
    "mvu/update-rules.yaml": `${presetNote}${stringifyYaml({ 变量更新规则: {} })}`,
    "mvu/variable-list.md": `${presetNote}${buildVariableList(variables)}`,
    "mvu/output-format.md": `${presetNote}${buildOutputFormat(variables)}`,
    ...(options.preset === "tavern_cards" ? {
      "html/变量更新中美化.html": `${MVU_LOADING_BEAUTIFY_HTML}\n`,
      "html/变量更新美化.html": `${MVU_DONE_BEAUTIFY_HTML}\n`,
    } : {}),
  };
  for (const [relative, content] of Object.entries(contents)) {
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, relative);
    if (!options.overwrite && await exists(filePath)) continue;
    await writeTextFile(filePath, content);
    files.push(filePath);
  }
  await enableMvuAssets(project);
  return { ok: true, project_id: project.id, preset: options.preset, files, next_actions: ["rewrite_mvu_variables 定义变量", "validate_mvu 检查一致性", "validate_project 检查项目"] };
}

export async function listMvuVariables(project: Project): Promise<{ ok: boolean; project_id: string; variables: MvuVariableRecord[] }> {
  const refs = await mvuPaths(project);
  const initvar = refs.initvar ? parseYaml<Record<string, unknown>>(await readTextFile(refs.initvar).catch(() => "{}")) ?? {} : {};
  const schema = refs.schema ? await readTextFile(refs.schema).catch(() => "") : "";
  const variableList = refs.variableList ? await readTextFile(refs.variableList).catch(() => "") : "";
  const outputFormat = refs.outputFormat ? await readTextFile(refs.outputFormat).catch(() => "") : "";
  const schemaKinds = parseControlledSchemaKinds(schema);
  const variables = Object.entries(flattenLeafValues(initvar)).map(([dotPath, defaultValue]) => ({ path: dotPath.split("."), dotPath, kind: schemaKinds[dotPath] ?? inferKind(defaultValue), defaultValue, inVariableList: variableList.includes(dotPath), inOutputFormat: outputFormat.includes(dotPath) }));
  return { ok: true, project_id: project.id, variables };
}

export async function upsertMvuVariable(project: Project, variable: MvuVariableInput, options: { rewrite?: MvuRewriteOptions } = {}): Promise<{ ok: boolean; project_id: string; variable: MvuVariableRecord; files: string[] }> {
  const current = await listMvuVariables(project);
  const dotPath = variable.path.join(".");
  const others = current.variables.filter((item) => item.dotPath !== dotPath);
  const next = [...others, { ...variable, dotPath, kind: variable.kind ?? inferKind(variable.defaultValue), defaultValue: variable.defaultValue, inVariableList: true, inOutputFormat: true }];
  const files = await rewriteMvuFiles(project, next, options.rewrite);
  const record = (await listMvuVariables(project)).variables.find((item) => item.dotPath === dotPath)!;
  return { ok: true, project_id: project.id, variable: record, files };
}

export async function removeMvuVariable(project: Project, variablePath: string[], options: { rewrite?: MvuRewriteOptions } = {}): Promise<{ ok: boolean; project_id: string; removed: string; files: string[] }> {
  const dotPath = variablePath.join(".");
  const current = await listMvuVariables(project);
  const files = await rewriteMvuFiles(project, current.variables.filter((item) => item.dotPath !== dotPath), options.rewrite);
  return { ok: true, project_id: project.id, removed: dotPath, files };
}

export async function rewriteMvuVariables(project: Project, variables: MvuVariableInput[], options: { rewrite?: MvuRewriteOptions } = {}): Promise<{ ok: boolean; project_id: string; count: number; files: string[] }> {
  const normalized = variables.map((variable) => ({ ...variable, dotPath: variable.path.join("."), kind: variable.kind ?? inferKind(variable.defaultValue), inVariableList: true, inOutputFormat: true }));
  const files = await rewriteMvuFiles(project, normalized, options.rewrite);
  return { ok: true, project_id: project.id, count: normalized.length, files };
}

async function rewriteMvuFiles(project: Project, variables: Array<MvuVariableInput & { dotPath: string }>, rewrite?: MvuRewriteOptions): Promise<string[]> {
  const options = { ...DEFAULT_REWRITE, ...(rewrite ?? {}) };
  await enableMvuAssets(project);
  const files: string[] = [];
  if (options.schema) files.push(await writeSource(project, "mvu/schema.js", buildSchemaJs(variables)));
  if (options.initvar) files.push(await writeSource(project, "mvu/initvar.yaml", stringifyYaml(unflattenValues(variables))));
  if (options.variableList) files.push(await writeSource(project, "mvu/variable-list.md", buildVariableList(variables)));
  if (options.updateRules) files.push(await writeSource(project, "mvu/update-rules.yaml", buildUpdateRules(variables)));
  if (options.outputFormat) files.push(await writeSource(project, "mvu/output-format.md", buildOutputFormat(variables)));
  return files;
}

async function enableMvuAssets(project: Project): Promise<void> {
  const draft = await readDraft(project);
  await writeDraft(project, "assets", { ...(draft.assets ?? {}), mvu: { ...(draft.assets?.mvu ?? {}), enabled: true, ...MVU_REFS }, html: draft.assets?.html ?? { statusbar: { enabled: false } }, regex: draft.assets?.regex ?? {}, ejs: draft.assets?.ejs ?? { enabled: false, entries: [] } });
}

async function mvuPaths(project: Project): Promise<{ schema?: string; initvar?: string; updateRules?: string; variableList?: string; outputFormat?: string }> {
  const draft = await readDraft(project);
  const mvu = draft.assets?.mvu;
  const assetsFile = draftPath(project, "assets");
  return {
    schema: mvu?.schema ? resolveDraftReference(projectDir(project.slug), assetsFile, mvu.schema) : undefined,
    initvar: mvu?.initvar ? resolveDraftReference(projectDir(project.slug), assetsFile, mvu.initvar) : undefined,
    updateRules: mvu?.updateRules ? resolveDraftReference(projectDir(project.slug), assetsFile, mvu.updateRules) : undefined,
    variableList: mvu?.variableList ? resolveDraftReference(projectDir(project.slug), assetsFile, mvu.variableList) : undefined,
    outputFormat: mvu?.outputFormat ? resolveDraftReference(projectDir(project.slug), assetsFile, mvu.outputFormat) : undefined,
  };
}

async function writeSource(project: Project, relativePath: string, content: string): Promise<string> {
  const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, relativePath);
  await writeTextFile(filePath, content);
  return filePath;
}

function buildSchemaJs(variables: Array<Pick<MvuVariableInput, "path" | "kind" | "enumValues" | "min" | "max" | "description">>): string {
  const lines = ["// Generated by world-book-mcp v5. Edit via MVU variable tools.", "export const Schema = z.object({"];
  const tree = buildVariableTree(variables);
  for (const line of renderSchemaTree(tree, 1)) lines.push(line);
  lines.push("});", "");
  return lines.join("\n");
}

interface VariableTree { [key: string]: VariableTree | MvuVariableInput }
function buildVariableTree(variables: Array<MvuVariableInput>): VariableTree {
  const root: VariableTree = {};
  for (const variable of variables) {
    let cursor = root;
    for (const [index, segment] of variable.path.entries()) {
      if (index === variable.path.length - 1) cursor[segment] = variable;
      else cursor = cursor[segment] as VariableTree || (cursor[segment] = {} as VariableTree) as VariableTree;
    }
  }
  return root;
}

function renderSchemaTree(tree: VariableTree, depth: number): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    if (isVariableInput(value)) lines.push(`${indent}${JSON.stringify(key)}: ${schemaExpression(value)},`);
    else {
      lines.push(`${indent}${JSON.stringify(key)}: z.object({`);
      lines.push(...renderSchemaTree(value, depth + 1));
      lines.push(`${indent}}),`);
    }
  }
  return lines;
}

function schemaExpression(variable: MvuVariableInput): string {
  const kind = variable.kind ?? inferKind(variable.defaultValue);
  if (kind === "number") return `z.coerce.number()${typeof variable.min === "number" || typeof variable.max === "number" ? `.transform(v => _.clamp(v, ${variable.min ?? "-Infinity"}, ${variable.max ?? "Infinity"}))` : ""}`;
  if (kind === "boolean") return "z.boolean()";
  if (kind === "enum" && variable.enumValues?.length) return `z.enum([${variable.enumValues.map((item) => JSON.stringify(item)).join(", ")}])`;
  if (kind === "record") return "z.record(z.string(), z.unknown())";
  if (kind === "object") return "z.object({})";
  return "z.string()";
}

function buildVariableList(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  const descriptions = variables.map((variable) => `- stat_data.${variable.dotPath}${variable.description ? `：${variable.description}` : ""}`).join("\n");
  return `---\n<status_current_variables>\n{{format_message_variable::stat_data}}\n</status_current_variables>\n\n# 变量说明\n${descriptions}\n`;
}

function buildUpdateRules(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  const rules: Record<string, unknown> = {};
  for (const variable of variables) {
    if (shouldSkipUpdateRule(variable)) continue;
    const kind = variable.kind ?? inferKind(variable.defaultValue);
    const rule: Record<string, unknown> = {};
    if (kind === "number") {
      rule.type = "number";
      if (typeof variable.min === "number" || typeof variable.max === "number") rule.range = `${variable.min ?? "-Infinity"}~${variable.max ?? "Infinity"}`;
    } else if (kind === "boolean") {
      rule.type = "boolean";
    } else if (kind === "enum" && variable.enumValues?.length) {
      rule.type = variable.enumValues.map((item) => `'${item}'`).join("|");
    } else if (kind === "record") {
      rule.type = "{ [键名: string]: unknown }";
    } else if (kind === "object") {
      rule.type = "object";
    }
    if (variable.description) rule.value = variable.description;
    if (Object.keys(rule).length > 0) setNested(rules, variable.path, rule);
  }
  return stringifyYaml({ 变量更新规则: rules });
}

function shouldSkipUpdateRule(variable: MvuVariableInput & { dotPath: string }): boolean {
  const last = variable.path.at(-1) ?? variable.dotPath;
  return Boolean(variable.readonly || variable.hidden || last.startsWith("_") || last.startsWith("$") || variable.dotPath.split(".").some((segment) => segment.startsWith("_") || segment.startsWith("$")));
}

function buildOutputFormat(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  const examples = variables.filter((variable) => !shouldSkipUpdateRule(variable)).map((variable) => `      { "op": "replace", "path": "/${variable.path.join("/")}", "value": ${JSON.stringify(variable.defaultValue ?? defaultForKind(variable.kind))} }`).join(",\n");
  return `---\n变量输出格式:\n  rule:\n    - 在下一次回复末尾同时输出更新分析和实际更新命令。\n    - 更新命令必须是 JSON Patch 风格的 JSON 数组；路径不带 stat_data 根键。\n    - 支持 replace、delta、insert、remove、move；不要更新字段名以 _ 或 $ 开头的变量。\n  tracked_variables:\n${variables.map((variable) => `    - stat_data.${variable.dotPath}`).join("\n")}\n  format: |-\n    <UpdateVariable>\n    <Analysis>$(IN ENGLISH, no more than 80 words; analyze only the current reply.)</Analysis>\n    <JSONPatch>\n    [\n${examples || "      { \"op\": \"replace\", \"path\": \"/变量路径\", \"value\": \"新值\" }"}\n    ]\n    </JSONPatch>\n    </UpdateVariable>\n`;
}

function unflattenValues(variables: Array<MvuVariableInput & { dotPath: string }>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const variable of variables) setNested(root, variable.path, variable.defaultValue ?? defaultForKind(variable.kind));
  return root;
}

function setNested(root: Record<string, unknown>, segments: string[], value: unknown): void {
  let cursor = root;
  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) cursor[segment] = value;
    else cursor = (cursor[segment] && typeof cursor[segment] === "object" ? cursor[segment] : (cursor[segment] = {})) as Record<string, unknown>;
  }
}

function flattenLeafValues(value: unknown, prefix = ""): Record<string, unknown> {
  if (!isRecord(value)) return prefix ? { [prefix]: value } : {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) Object.assign(result, flattenLeafValues(child, prefix ? `${prefix}.${key}` : key));
  return result;
}

function parseControlledSchemaKinds(schema: string): Record<string, MvuVariableKind> {
  const result: Record<string, MvuVariableKind> = {};
  for (const match of schema.matchAll(/"([^"]+)"\s*:\s*z\.(string|number|boolean|enum|record|object)\s*\(/g)) result[match[1]] = match[2] as MvuVariableKind;
  return result;
}

function inferKind(value: unknown): MvuVariableKind {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
}

function defaultForKind(kind?: MvuVariableKind): unknown {
  if (kind === "number") return 0;
  if (kind === "boolean") return false;
  if (kind === "object" || kind === "record") return {};
  return "";
}

function isVariableInput(value: unknown): value is MvuVariableInput {
  return isRecord(value) && Array.isArray(value.path);
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function exists(filePath: string): Promise<boolean> { try { await readTextFile(filePath); return true; } catch { return false; } }
