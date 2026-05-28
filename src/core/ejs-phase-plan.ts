import type { EjsConfig, EjsEntryConfig } from "../schemas/ejs.js";

export interface EjsPhaseInput {
  character_name?: string;
  affection_path?: string;
  relationship_path?: string;
  phases?: Array<{
    name: string;
    short_name?: string;
    affection_min_inclusive?: number;
    affection_max_exclusive?: number;
    relationship_equals?: string;
  }>;
}

export interface EjsPhasePlanResult {
  ejs: EjsConfig;
  phase_table: Array<{ name: string; condition: string; targetSliceId: string }>;
}

export function createEjsPhasePlan(input: EjsPhaseInput | string = {}): EjsPhasePlanResult | EjsEntryConfig[] {
  if (typeof input === "string") return [{ name: input, role: "controller", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true, variablePaths: [], templateType: "custom", stages: [] }];
  const characterName = input.character_name ?? "角色A";
  const affectionPath = input.affection_path ?? `stat_data.${characterName}.好感度`;
  const relationshipPath = input.relationship_path;
  const phases = input.phases?.length ? input.phases : [
    { name: "初识", short_name: "初识", affection_max_exclusive: 150 },
    { name: "熟悉", short_name: "熟悉", affection_min_inclusive: 150, affection_max_exclusive: 400 },
    { name: "深入", short_name: "深入", affection_min_inclusive: 400 },
  ];
  const phaseTable = phases.map((phase, index) => {
    const targetSliceId = `${characterName}_阶段${String(index + 1).padStart(2, "0")}_${phase.short_name ?? phase.name}`;
    return { name: phase.name, condition: conditionForPhase(phase, index === phases.length - 1), targetSliceId };
  });
  const variablePaths = [affectionPath, relationshipPath].filter((path): path is string => Boolean(path));
  const declarations = [`if (typeof gw === 'undefined') var gw = getvar('${affectionPath}', { defaults: 0 });`, ...(relationshipPath ? [`if (typeof rel === 'undefined') var rel = getvar('${relationshipPath}', { defaults: '陌生人' });`] : [])].join("\n");
  const branches = phaseTable.map((phase, index) => {
    const start = index === 0 ? `<%_ if (${phase.condition}) { _%>` : phase.condition === "else" ? `<%_ } else { _%>` : `<%_ } else if (${phase.condition}) { _%>`;
    return `${start}\n<%- await getwi('${phase.targetSliceId}') %>`;
  }).join("\n");
  const controller: EjsEntryConfig = {
    name: `${characterName}_阶段控制器`,
    role: "controller",
    content: `<%_\n${declarations}\n_%>\n\n${branches}\n<%_ } _%>`,
    keys: [],
    constant: true,
    position: "after_char",
    order: 100,
    enabled: true,
    variablePaths,
    templateType: "phase_profile",
    stages: phaseTable.map((phase) => ({ name: phase.name, condition: phase.condition, targetSliceId: phase.targetSliceId })),
  };
  const stages: EjsEntryConfig[] = phaseTable.map((phase) => ({
    name: phase.targetSliceId,
    role: "stage",
    content: `${phase.name}阶段内容`,
    keys: [],
    constant: false,
    position: "after_char",
    order: 98,
    enabled: false,
    variablePaths: [],
    templateType: "phase_profile",
  }));
  return { ejs: { entries: [controller, ...stages] }, phase_table: phaseTable };
}

function conditionForPhase(phase: NonNullable<EjsPhaseInput["phases"]>[number], isLast: boolean): string {
  if (phase.relationship_equals) return `rel === ${JSON.stringify(phase.relationship_equals)}`;
  const parts: string[] = [];
  if (phase.affection_min_inclusive !== undefined) parts.push(`gw >= ${phase.affection_min_inclusive}`);
  if (phase.affection_max_exclusive !== undefined) parts.push(`gw < ${phase.affection_max_exclusive}`);
  if (parts.length === 0 && isLast) return "else";
  return parts.join(" && ") || "true";
}
