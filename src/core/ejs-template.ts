import type { EjsConfig } from "../schemas/ejs.js";

export function createEjsTemplate(input: { templateType?: "phase_profile" | "palette" | "custom"; characterName?: string } = {}): { ejs: EjsConfig } {
  const templateType = input.templateType ?? "phase_profile";
  const characterName = input.characterName ?? "角色";
  return {
    ejs: {
      enabled: true,
      template_type: templateType,
      variable_paths: ["stat_data.phase"],
      entries: [
        {
          name: `${characterName}_阶段控制器`,
          role: "controller",
          content: "<% const phase = stat_data?.phase ?? 'default'; %>",
          keys: [],
          constant: true,
          position: "before_char",
          order: 90,
          enabled: true,
        },
        {
          name: `${characterName}_阶段描写`,
          role: "stage",
          content: "<% if (phase) { %>阶段：<%= phase %><% } %>",
          keys: [],
          constant: true,
          position: "before_char",
          order: 100,
          enabled: false,
        },
      ],
    },
  };
}
