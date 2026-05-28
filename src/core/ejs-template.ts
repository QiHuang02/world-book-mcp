import type { EjsConfig, EjsEntryConfig } from "../schemas/ejs.js";

export interface CreateEjsTemplateInput {
  id?: string;
  title?: string;
  preset?: string;
  templateType?: EjsEntryConfig["templateType"];
  characterName?: string;
}

export interface CreateEjsTemplateResult {
  ejs: EjsConfig;
}

export function createEjsControllerTemplate(name = "阶段控制器"): EjsEntryConfig {
  return { name, role: "controller", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true, variablePaths: [], templateType: "custom", stages: [] };
}

export function createEjsStageTemplate(name = "阶段条目"): EjsEntryConfig {
  return { name, role: "stage", content: "阶段内容", keys: [], constant: false, position: "after_char", order: 98, enabled: false, variablePaths: [], templateType: "custom" };
}

export function createEjsTemplate(input: CreateEjsTemplateInput = {}): CreateEjsTemplateResult {
  const characterName = input.characterName ?? "角色A";
  const affectionPath = `stat_data.${characterName}.好感度`;
  const templateType = input.templateType ?? input.preset === "phase_profile" ? "phase_profile" : input.preset === "palette" ? "palette" : "custom";
  if (templateType === "phase_profile") return createPhaseProfileTemplate(characterName, affectionPath);
  const id = input.id ?? `${characterName}_动态条目`;
  const role: EjsEntryConfig["role"] = input.preset === "stage" ? "stage" : "inline";
  const entry: EjsEntryConfig = {
    name: input.title ?? id,
    role,
    content: role === "stage" ? "阶段内容" : inlineTemplate(affectionPath),
    keys: [],
    constant: role !== "stage",
    position: "after_char",
    order: role === "stage" ? 98 : 100,
    enabled: role === "stage" ? false : true,
    variablePaths: role === "stage" ? [] : [affectionPath],
    templateType,
  };
  return withVariablePaths([entry]);
}

function createPhaseProfileTemplate(characterName: string, affectionPath: string): CreateEjsTemplateResult {
  const stages = [
    `${characterName}_阶段01_初识`,
    `${characterName}_阶段02_熟悉`,
    `${characterName}_阶段03_亲近`,
  ];
  const controller: EjsEntryConfig = {
    name: `${characterName}_阶段控制器`,
    role: "controller",
    content: `<%_\nif (typeof gw === 'undefined') var gw = getvar('${affectionPath}', { defaults: 0 });\n_%>\n\n<%_ if (gw < 30) { _%>\n<%- await getwi('${stages[0]}') %>\n<%_ } else if (gw < 70) { _%>\n<%- await getwi('${stages[1]}') %>\n<%_ } else { _%>\n<%- await getwi('${stages[2]}') %>\n<%_ } _%>\n\n跨阶段通用衍生：角色的底色不随阶段变化。`,
    keys: [],
    constant: true,
    position: "after_char",
    order: 100,
    enabled: true,
    variablePaths: [affectionPath],
    templateType: "phase_profile",
    stages: stages.map((name, index) => ({ name, condition: index === 0 ? "gw < 30" : index === 1 ? "gw >= 30 && gw < 70" : "else", targetSliceId: name })),
  };
  const stageEntries: EjsEntryConfig[] = stages.map((name, index) => ({
    name,
    role: "stage",
    content: `阶段${index + 1}内容：写入该阶段专属的人设、行为指导和二次解释。`,
    keys: [],
    constant: false,
    position: "after_char",
    order: 98,
    enabled: false,
    variablePaths: [],
    templateType: "phase_profile",
  }));
  return withVariablePaths([controller, ...stageEntries]);
}

function inlineTemplate(affectionPath: string): string {
  return `<%_\nif (typeof gw === 'undefined') var gw = getvar('${affectionPath}', { defaults: 0 });\n_%>\n\n<%_ if (gw < 50) { _%>\n阶段一内容\n<%_ } else { _%>\n阶段二内容\n<%_ } _%>`;
}

function withVariablePaths(entries: EjsEntryConfig[]): CreateEjsTemplateResult {
  return { ejs: { entries } };
}
