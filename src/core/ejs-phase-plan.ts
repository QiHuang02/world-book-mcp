import type { EjsConfig } from "../schemas/ejs.js";

export interface EjsPhaseInput {
  character_name: string;
  affection_path: string;
  relationship_path?: string;
  phases: Array<{ name: string; short_name?: string; affection_min_inclusive?: number; affection_max_exclusive?: number; relationship_equals?: string }>;
}

export function createEjsPhasePlan(input: EjsPhaseInput): { ejs: EjsConfig; phase_table: Array<{ name: string; condition: string }> } {
  const phase_table = input.phases.map((phase) => ({ name: phase.name, condition: phaseCondition(phase) }));
  const ejs: EjsConfig = {
    enabled: true,
    template_type: "phase_profile",
    variable_paths: [input.affection_path, ...(input.relationship_path ? [input.relationship_path] : [])],
    entries: [
      {
        name: `${input.character_name}_阶段控制器`,
        role: "controller",
        content: `<% const gw = await getwi('${input.affection_path}'); const rel = ${input.relationship_path ? `await getwi('${input.relationship_path}')` : "''"}; %>`,
        keys: [],
        constant: true,
        position: "before_char",
        order: 90,
        enabled: true,
      },
      ...phase_table.map((phase, index) => ({
        name: `${input.character_name}_${phase.name}`,
        role: "stage" as const,
        content: `<% if (${phase.condition}) { %>${phase.name}<% } %>`,
        keys: [],
        constant: true,
        position: "before_char" as const,
        order: 100 + index,
        enabled: false,
      })),
    ],
  };
  return { ejs, phase_table };
}

function phaseCondition(phase: EjsPhaseInput["phases"][number]): string {
  if (phase.relationship_equals) return `rel === '${phase.relationship_equals}'`;
  const parts: string[] = [];
  if (phase.affection_min_inclusive !== undefined) parts.push(`gw >= ${phase.affection_min_inclusive}`);
  if (phase.affection_max_exclusive !== undefined) parts.push(`gw < ${phase.affection_max_exclusive}`);
  return parts.join(" && ") || "true";
}
