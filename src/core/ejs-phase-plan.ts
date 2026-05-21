import type { EjsConfig, EjsEntryConfig } from "../schemas/ejs.js";

export interface EjsPhase {
  name: string;
  short_name?: string;
  affection_max_exclusive?: number;
  affection_min_inclusive?: number;
  relationship_equals?: string;
  relationship_not_equals?: string;
  description?: string;
  stage_entry_name?: string;
}

export interface EjsPhasePlanInput {
  character_name: string;
  affection_path: string;
  relationship_path?: string;
  phases: EjsPhase[];
}

export interface EjsPhasePlanResult {
  ejs: EjsConfig;
  phase_table: Array<{ name: string; condition: string; stage_entry_name: string }>;
  rules: string[];
}

export function createEjsPhasePlan(input: EjsPhasePlanInput): EjsPhasePlanResult {
  if (input.phases.length === 0) {
    return { ejs: { enabled: true, template_type: "phase_profile", variable_paths: [], entries: [] }, phase_table: [], rules: [] };
  }
  const variable_paths = uniq([input.affection_path, input.relationship_path].filter(Boolean) as string[]);
  const phase_table = input.phases.map((phase) => ({ name: phase.name, condition: describeCondition(phase), stage_entry_name: phase.stage_entry_name ?? `${input.character_name}_阶段_${phase.short_name ?? phase.name}` }));

  const controller = buildController(input, phase_table);
  const stages = phase_table.map((row, index) => buildStage(input, input.phases[index], row.stage_entry_name));

  return {
    ejs: {
      enabled: true,
      template_type: "phase_profile",
      variable_paths,
      entries: [controller, ...stages],
    },
    phase_table,
    rules: [
      "controller 蓝灯常驻 order=100，负责读取变量并 await getwi 加载阶段条目",
      "stage 条目 enabled=false，由 controller 通过 getwi 按需加载",
      "条件边界使用 < 与 >= 切分，避免重叠或遗漏",
      "字符串状态比较使用 === / !==",
    ],
  };
}

function describeCondition(phase: EjsPhase): string {
  const parts: string[] = [];
  if (phase.affection_min_inclusive !== undefined) parts.push(`gw >= ${phase.affection_min_inclusive}`);
  if (phase.affection_max_exclusive !== undefined) parts.push(`gw < ${phase.affection_max_exclusive}`);
  if (phase.relationship_equals) parts.push(`rel === '${phase.relationship_equals}'`);
  if (phase.relationship_not_equals) parts.push(`rel !== '${phase.relationship_not_equals}'`);
  return parts.join(" && ") || "true";
}

function buildController(input: EjsPhasePlanInput, table: Array<{ stage_entry_name: string; condition: string }>): EjsEntryConfig {
  const reads: string[] = [
    `if (typeof gw === 'undefined') var gw = getvar('${input.affection_path}', { defaults: 0 });`,
  ];
  if (input.relationship_path) reads.push(`if (typeof rel === 'undefined') var rel = getvar('${input.relationship_path}', { defaults: '' });`);
  const branches = table.map((row, index) => {
    const keyword = index === 0 ? "if" : "} else if";
    return `<%_ ${keyword} (${row.condition}) { _%>\n<%- await getwi('${row.stage_entry_name}') %>`;
  });
  const tail = table.length > 0 ? "<%_ } _%>" : "";
  const content = `<%_\n${reads.join("\n")}\n_%>\n\n${branches.join("\n")}\n${tail}`;
  return {
    name: `${input.character_name}_阶段控制器`,
    role: "controller",
    content,
    keys: [],
    constant: true,
    position: "after_char",
    order: 100,
    enabled: true,
  };
}

function buildStage(input: EjsPhasePlanInput, phase: EjsPhase, name: string): EjsEntryConfig {
  const description = phase.description?.trim() ?? "";
  const content = `<%_\nif (typeof gw === 'undefined') var gw = getvar('${input.affection_path}', { defaults: 0 });\n_%>\n\n阶段：${phase.name}\n${description || "（待补充阶段细节）"}`;
  return {
    name,
    role: "stage",
    content,
    keys: [],
    constant: true,
    position: "after_char",
    order: 98,
    enabled: false,
  };
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}
