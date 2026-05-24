import type { Project } from "../schemas/project.js";
import { buildCharacterCardJson, type CharacterCardJson } from "./character-card-builder.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";
import { validateEjsConfig } from "./ejs-validator.js";
import { validateHtmlBeautifyConfig } from "./html-beautify-validator.js";
import { buildProjectAssets } from "./project-assets.js";
import { validateMvuConfig } from "./mvu-validator.js";

export type CharacterCardProjectValidation = ReturnType<typeof validateCharacterCardConfig> | ReturnType<typeof validateMvuConfig> | ReturnType<typeof validateHtmlBeautifyConfig> | ReturnType<typeof validateEjsConfig>;

export function validateCharacterCardProject(project: Project): CharacterCardProjectValidation {
  if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
  const validation = validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled });
  if (!validation.valid) return validation;
  const mvuValidation = project.mvuConfig?.enabled ? validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : undefined;
  if (mvuValidation && !mvuValidation.valid) return mvuValidation;
  const htmlValidation = project.htmlBeautifyConfig?.enabled ? validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : undefined;
  if (htmlValidation && !htmlValidation.valid) return htmlValidation;
  const ejsValidation = project.ejsConfig?.enabled ? validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig }) : undefined;
  if (ejsValidation && !ejsValidation.valid) return ejsValidation;
  return validation;
}

export function buildCharacterCardJsonFromProject(project: Project, extraRegexScripts: import("./mvu-assets.js").RegexScriptAsset[] = []): { card: CharacterCardJson; validation: CharacterCardProjectValidation } {
  if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
  const validation = validateCharacterCardProject(project);
  if (!validation.valid) return { card: undefined as never, validation };
  const assets = buildProjectAssets(project, "all", extraRegexScripts);
  return {
    validation,
    card: buildCharacterCardJson({
      config: project.characterCardConfig,
      worldbookEntries: project.draft,
      worldbookName: project.characterCardConfig.worldbook.name ?? project.name,
      // assets.regex_scripts 已经包含 mvu + html + 第三方脚本（buildProjectAssets("all") 内部合并并去重过），
      // 因此这里只把整个集合放进 mvuAssets.regexScripts 一处，不再额外传 htmlAssets，避免双袋子重复输出。
      mvuAssets: { worldbookEntries: assets.worldbook_entries, regexScripts: assets.regex_scripts, tavernHelperScripts: assets.tavern_helper_scripts },
      ejsEntries: assets.ejs_entries,
    }),
  };
}
