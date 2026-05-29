import type { Project } from "../schemas/project.js";
import { draftPath, projectDir, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveDraftReference, resolveSourceFilePath } from "../storage/path-policy.js";
import { parseYaml, readTextFile, stringifyYaml, writeTextFile } from "../utils/yaml.js";

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
  const variables: MvuVariableInput[] = [];
  const presetNote = options.preset === "nova" ? "# nova profile: initvar → update-rules → variable-list → output-format\n" : options.preset === "tavern_cards" ? "# tavern-cards profile: [InitVar] / [mvu_update] / [mvu_plot] prefixes\n" : "";
  const contents: Record<string, string> = {
    "mvu/schema.js": buildSchemaJs(variables),
    "mvu/initvar.yaml": "{}\n",
    "mvu/update-rules.yaml": `${presetNote}# 在此描述变量更新规则。\n`,
    "mvu/variable-list.md": `${presetNote}# 变量列表\n`,
    "mvu/output-format.md": `${presetNote}# 变量输出格式\n`,
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
  const root = projectDir(project.slug);
  if (options.schema) files.push(await writeSource(project, "mvu/schema.js", buildSchemaJs(variables)));
  if (options.initvar) files.push(await writeSource(project, "mvu/initvar.yaml", stringifyYaml(unflattenValues(variables))));
  if (options.variableList) files.push(await writeSource(project, "mvu/variable-list.md", buildVariableList(variables)));
  if (options.updateRules) files.push(await writeSource(project, "mvu/update-rules.yaml", buildUpdateRules(variables)));
  if (options.outputFormat) files.push(await writeSource(project, "mvu/output-format.md", buildOutputFormat(variables)));
  void root;
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
  if (kind === "number") return `z.number()${typeof variable.min === "number" || typeof variable.max === "number" ? `.transform(v => _.clamp(v, ${variable.min ?? "-Infinity"}, ${variable.max ?? "Infinity"}))` : ""}`;
  if (kind === "boolean") return "z.boolean()";
  if (kind === "enum" && variable.enumValues?.length) return `z.enum([${variable.enumValues.map((item) => JSON.stringify(item)).join(", ")}])`;
  if (kind === "record") return "z.record(z.string(), z.unknown())";
  if (kind === "object") return "z.object({})";
  return "z.string()";
}

function buildVariableList(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  return `${variables.map((variable) => `- ${variable.dotPath}${variable.description ? `：${variable.description}` : ""}`).join("\n")}\n`;
}

function buildUpdateRules(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  const value = Object.fromEntries(variables.map((variable) => [variable.dotPath, variable.readonly ? "只读，不由 AI 更新" : "根据剧情合理更新"]));
  return stringifyYaml(value);
}

function buildOutputFormat(variables: Array<MvuVariableInput & { dotPath: string }>): string {
  return `${variables.map((variable) => `- ${variable.dotPath}: {{getvar::stat_data.${variable.dotPath}}}`).join("\n")}\n`;
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
