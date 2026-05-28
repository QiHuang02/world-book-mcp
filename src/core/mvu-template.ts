import type { MvuConfig } from "../schemas/mvu.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createMvuSystemEntries, DEFAULT_MVU_OUTPUT_FORMAT } from "./mvu-entry-templates.js";

export interface CreateMvuTemplateInput {
  characterNames?: string[];
  variableListPath?: string;
}

export interface CreateMvuTemplateResult {
  mvu: MvuConfig;
  entries: WorldbookDraftEntry[];
}

const TEMPLATE_IMPORT = "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';";

export function createDefaultMvuConfig(): MvuConfig {
  return createMvuTemplate().mvu;
}

export function createMvuTemplate(input: CreateMvuTemplateInput = {}): CreateMvuTemplateResult {
  const variableListPath = input.variableListPath ?? "stat_data";
  const characterNames = uniqueNames(input.characterNames?.length ? input.characterNames : ["角色A"]);
  const variables = defaultVariables(characterNames);
  const mvu: MvuConfig = {
    schemaScript: buildSchemaScript(variables),
    variableListPath,
    hideRegex: true,
    beautifyRegex: true,
  };
  return {
    mvu,
    entries: createMvuSystemEntries({ runtime: mvu, initvar: buildInitvar(variables), updateRules: buildUpdateRules(variables), outputFormat: defaultOutputFormat() }),
  };
}

export interface TemplateVariable {
  path: string[];
  expression: string;
  defaultValue: unknown;
  updateRule?: { type?: string; range?: string; check: string[] };
}

function defaultVariables(characterNames: string[]): TemplateVariable[] {
  return characterNames.flatMap((name): TemplateVariable[] => [
    {
      path: [name, "好感度"],
      expression: "z.coerce.number().transform(value => _.clamp(value, 0, 100)).prefault(0)",
      defaultValue: 0,
      updateRule: { type: "number", range: "0~100", check: [`根据${name}对<user>当前回复中行为的感知和反应调整 ±(1~5)`, "仅在本次回复实际体现关系变化时更新，避免无依据剧烈变化"] },
    },
    {
      path: [name, "心情"],
      expression: "z.string().prefault('平静')",
      defaultValue: "平静",
      updateRule: { type: "string", check: ["根据当前场景和对话更新为简短明确的情绪词", "不要把长期性格写入心情变量"] },
    },
  ]);
}

function buildSchemaScript(vars: TemplateVariable[]): string {
  return `${TEMPLATE_IMPORT}\n\nexport const Schema = z.object({\n${buildObjectFields(vars, 1)}\n});\n\n$(() => {\n  registerMvuSchema(Schema);\n});`;
}

function buildObjectFields(vars: TemplateVariable[], level: number): string {
  const grouped = new Map<string, TemplateVariable[]>();
  const leaves: TemplateVariable[] = [];
  for (const variable of vars) {
    if (variable.path.length === level) leaves.push(variable);
    else {
      const key = variable.path[level - 1];
      grouped.set(key, [...(grouped.get(key) ?? []), variable]);
    }
  }
  const lines: string[] = [];
  for (const [key, children] of grouped) {
    lines.push(`${indent(level)}${propertyKey(key)}: z.object({\n${buildObjectFields(children, level + 1)}\n${indent(level)}})`);
  }
  for (const leaf of leaves) lines.push(`${indent(level)}${propertyKey(leaf.path.at(-1) ?? "变量")}: ${leaf.expression}`);
  return lines.map((line, index) => `${line}${index === lines.length - 1 ? "" : ","}`).join("\n");
}

export function buildInitvar(vars: TemplateVariable[]): string {
  const root: Record<string, unknown> = {};
  for (const variable of vars) setNested(root, variable.path, variable.defaultValue);
  return yamlLines(root).join("\n");
}

export function buildUpdateRules(vars: TemplateVariable[]): string {
  const root: Record<string, unknown> = {};
  for (const variable of vars) {
    if (variable.path.at(-1)?.startsWith("_")) continue;
    if (!variable.updateRule) continue;
    setNested(root, variable.path, variable.updateRule);
  }
  return ["变量更新规则:", ...yamlLines(root, 1)].join("\n");
}

export function defaultOutputFormat(): string {
  return DEFAULT_MVU_OUTPUT_FORMAT;
}

function setNested(target: Record<string, unknown>, path: string[], value: unknown): void {
  let current = target;
  for (const [index, key] of path.entries()) {
    if (index === path.length - 1) current[key] = value;
    else {
      if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) current[key] = {};
      current = current[key] as Record<string, unknown>;
    }
  }
}

function yamlLines(value: Record<string, unknown>, level = 0): string[] {
  const lines: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      lines.push(`${"  ".repeat(level)}${yamlKey(key)}:`);
      lines.push(...yamlLines(child as Record<string, unknown>, level + 1));
    } else if (Array.isArray(child)) {
      lines.push(`${"  ".repeat(level)}${yamlKey(key)}:`);
      for (const item of child) lines.push(`${"  ".repeat(level + 1)}- ${yamlScalar(item)}`);
    } else {
      lines.push(`${"  ".repeat(level)}${yamlKey(key)}: ${yamlScalar(child)}`);
    }
  }
  return lines;
}

function yamlScalar(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[:#\n\r]|^\s|\s$|^(?:true|false|null|~|-?\d+(?:\.\d+)?)$/i.test(text) ? JSON.stringify(text) : text;
}

function yamlKey(value: string): string {
  return /[:#\n\r]|^\s|\s$/.test(value) ? JSON.stringify(value) : value;
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function indent(level: number): string { return "  ".repeat(level); }
function propertyKey(key: string): string { return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key); }
