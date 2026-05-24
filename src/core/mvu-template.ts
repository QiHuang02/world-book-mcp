import type { MvuConfig } from "../schemas/mvu.js";

export function createMvuTemplate(input: { characterNames: string[]; variableListPath?: string }): { mvu: MvuConfig; rules: string[] } {
  const names = input.characterNames.length > 0 ? input.characterNames : ["角色"];
  const schemaFields = names
    .map((name) => `  ${safeIdentifier(name)}: z.object({\n    好感度: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(20),\n    心情: z.string().prefault('平静'),\n  })`)
    .join(",\n");
  const initvar = names.map((name) => `${name}:\n  好感度: 20\n  心情: 平静`).join("\n");
  const updateRules = [
    "变量更新规则:",
    ...names.flatMap((name) => [
      `  ${name}:`,
      "    好感度:",
      "      type: number",
      "      range: 0~100",
      "      check:",
      "        - 根据互动、承诺、冲突、照顾行为调整 ±(1~6)",
      "    心情:",
      "      check:",
      "        - 根据当前场景、对话内容和关系变化更新为简短中文词语",
    ]),
  ].join("\n");

  return {
    mvu: {
      enabled: true,
      style: "zod",
      schema_script: `import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\nexport const Schema = z.object({\n${schemaFields}\n});\n\n$(() => {\n  registerMvuSchema(Schema);\n});`,
      initvar,
      update_rules: updateRules,
      output_format: "",
      variable_list_path: input.variableListPath ?? "stat_data",
      hide_regex: true,
      beautify_regex: true,
    },
    rules: [
      "schema_script 必须包含 registerMvuSchema 调用",
      "z 和 _ 由酒馆环境注入，不要手动 import",
      "initvar / update_rules / output_format 填纯 YAML（不要带 `---` 分隔符或 XML 包裹），builder 会自动包裹 <initvar> / <variable_update_rules> / <variable_output_format>",
      "启用 MVU 后 first_mes 和 alternate_greetings 建议包含 <StatusPlaceHolderImpl/>",
    ],
  };
}

function safeIdentifier(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}
