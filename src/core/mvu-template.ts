import type { MvuConfig } from "../schemas/mvu.js";

export interface CreateMvuTemplateInput {
  characterNames?: string[];
  variableListPath?: string;
}

export interface CreateMvuTemplateResult {
  mvu: MvuConfig;
}

const TEMPLATE_IMPORT = "import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';";

export function createDefaultMvuConfig(): MvuConfig {
  return createMvuTemplate().mvu;
}

export function createMvuTemplate(input: CreateMvuTemplateInput = {}): CreateMvuTemplateResult {
  const variableListPath = input.variableListPath ?? "stat_data";
  const characterNames = uniqueNames(input.characterNames?.length ? input.characterNames : ["角色A"]);
  const variables = defaultVariables(characterNames);
  return {
    mvu: {
      schemaScript: buildSchemaScript(variables),
      initvar: buildInitvar(variables),
      updateRules: buildUpdateRules(variables),
      outputFormat: defaultOutputFormat(),
      variableListPath,
      hideRegex: true,
      beautifyRegex: true,
    },
  };
}

interface TemplateVariable {
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

function buildInitvar(vars: TemplateVariable[]): string {
  const root: Record<string, unknown> = {};
  for (const variable of vars) setNested(root, variable.path, variable.defaultValue);
  return yamlLines(root).join("\n");
}

function buildUpdateRules(vars: TemplateVariable[]): string {
  const root: Record<string, unknown> = {};
  for (const variable of vars) {
    if (variable.path.at(-1)?.startsWith("_")) continue;
    if (!variable.updateRule) continue;
    setNested(root, variable.path, variable.updateRule);
  }
  return ["变量更新规则:", ...yamlLines(root, 1)].join("\n");
}

export function defaultOutputFormat(): string {
  return `变量输出格式:\n  rule:\n    - you must output the update analysis and the actual update commands at once in the end of the next reply\n    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:\n      - replace: replace the value of existing paths\n      - delta: update the value of existing number paths by a delta value\n      - insert: insert new items into an object or array (using \`-\` as array index intends appending to the end)\n      - remove\n      - move\n    - don't update field names starts with \`_\` as they are readonly, such as \`_变量\`\n  format: |-\n    <UpdateVariable>\n    <Analysis>$(IN ENGLISH, no more than 80 words)\n    - \${calculate time passed: ...}\n    - \${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}\n    - \${analyze every variable based on its corresponding \`check\`, according only to current reply instead of previous plots: ...}\n    </Analysis>\n    <JSONPatch>\n    [\n      { "op": "replace", "path": "\${/path/to/variable}", "value": "\${new_value}" },\n      { "op": "delta", "path": "\${/path/to/number/variable}", "value": "\${positive_or_negative_delta}" },\n      { "op": "insert", "path": "\${/path/to/object/new_key}", "value": "\${new_value}" },\n      { "op": "insert", "path": "\${/path/to/array/-}", "value": "\${new_value}" },\n      { "op": "remove", "path": "\${/path/to/object/key}" },\n      { "op": "remove", "path": "\${/path/to/array/0}" },\n      { "op": "move", "from": "\${/path/to/variable}", "to": "\${/path/to/another/path}" }\n    ]\n    </JSONPatch>\n    </UpdateVariable>`;
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
