import type { EjsConfig, EjsEntryConfig } from "../schemas/ejs.js";

export function createEjsTemplate(input: {
  templateType: "phase_profile" | "palette" | "custom";
  characterName: string;
  affectionPath?: string;
  relationshipPath?: string;
}): { ejs: EjsConfig; rules: string[] } {
  const affectionPath = input.affectionPath || `stat_data.${input.characterName}.好感度`;
  const relationshipPath = input.relationshipPath || `stat_data.${input.characterName}.关系状态`;
  const entries = input.templateType === "custom"
    ? customEntries(input.characterName, affectionPath)
    : input.templateType === "palette"
      ? paletteEntries(input.characterName, affectionPath, relationshipPath)
      : phaseEntries(input.characterName, affectionPath, relationshipPath);

  return {
    ejs: {
      enabled: true,
      template_type: input.templateType,
      variable_paths: [affectionPath, relationshipPath],
      entries,
    },
    rules: [
      "EJS 必须依赖 MVU 变量，变量路径应以 stat_data 开头",
      "读取变量建议使用 var + typeof 防重复声明",
      "getwi 必须使用 await getwi('条目名')",
      "被 getwi 加载的阶段条目应设置 enabled=false",
    ],
  };
}

function phaseEntries(name: string, affectionPath: string, relationshipPath: string): EjsEntryConfig[] {
  return [controller(name, affectionPath, relationshipPath, "阶段控制器", ["初识", "熟悉", "暧昧", "恋人"]), ...stageNames(name, ["初识", "熟悉", "暧昧", "恋人"]).map((stage) => stageEntry(stage))];
}

function paletteEntries(name: string, affectionPath: string, relationshipPath: string): EjsEntryConfig[] {
  return [controller(name, affectionPath, relationshipPath, "调色盘控制器", ["冷淡", "柔和", "亲近"]), ...stageNames(name, ["冷淡", "柔和", "亲近"]).map((stage) => stageEntry(stage, "此处填写当前阶段的文风、措辞、氛围和动作描写偏好。"))];
}

function customEntries(name: string, affectionPath: string): EjsEntryConfig[] {
  return [{
    name: `${name}_EJS自定义条目`,
    role: "inline",
    content: `<%_\nif (typeof gw === 'undefined') var gw = getvar('${affectionPath}', { defaults: 0 });\n_%>\n<%_ if (gw < 150) { _%>\n此处填写低阶段内容。\n<%_ } else { _%>\n此处填写高阶段内容。\n<%_ } _%>`,
    keys: [],
    constant: true,
    position: "after_char",
    order: 99,
    enabled: true,
  }];
}

function controller(name: string, affectionPath: string, relationshipPath: string, suffix: string, labels: string[]): EjsEntryConfig {
  const stages = stageNames(name, labels);
  return {
    name: `${name}_${suffix}`,
    role: "controller",
    content: `<%_\nif (typeof gw === 'undefined') var gw = getvar('${affectionPath}', { defaults: 0 });\nif (typeof rel === 'undefined') var rel = getvar('${relationshipPath}', { defaults: '陌生人' });\n_%>\n<%_ if (rel === '恋人') { _%>\n<%- await getwi('${stages[stages.length - 1]}') %>\n<%_ } else if (gw < 150) { _%>\n<%- await getwi('${stages[0]}') %>\n<%_ } else if (gw < 400) { _%>\n<%- await getwi('${stages[1]}') %>\n<%_ } else { _%>\n<%- await getwi('${stages[Math.min(2, stages.length - 1)]}') %>\n<%_ } _%>`,
    keys: [],
    constant: true,
    position: "after_char",
    order: 100,
    enabled: true,
  };
}

function stageNames(name: string, labels: string[]): string[] {
  return labels.map((label, index) => `${name}_阶段${String(index + 1).padStart(2, "0")}_${label}`);
}

function stageEntry(name: string, content = "此处填写该阶段应发送给 AI 的具体设定内容。未提及的信息不要补完。"): EjsEntryConfig {
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
