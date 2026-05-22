import type { Project } from "../schemas/project.js";
import { buildCharacterCardJson, type CharacterCardJson } from "./character-card-builder.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";
import { buildEjsEntries } from "./ejs-entries.js";
import { validateEjsConfig } from "./ejs-validator.js";
import { buildHtmlBeautifyAssets } from "./html-beautify-assets.js";
import { validateHtmlBeautifyConfig } from "./html-beautify-validator.js";
import { buildMvuAssets } from "./mvu-assets.js";
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

export function buildCharacterCardJsonFromProject(project: Project): { card: CharacterCardJson; validation: CharacterCardProjectValidation } {
  if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
  const validation = validateCharacterCardProject(project);
  if (!validation.valid) return { card: undefined as never, validation };
  const mvuAssets = project.mvuConfig?.enabled ? buildMvuAssets(project.mvuConfig) : undefined;
  const htmlAssets = project.htmlBeautifyConfig?.enabled ? buildHtmlBeautifyAssets(project.htmlBeautifyConfig) : undefined;
  const ejsEntries = project.ejsConfig?.enabled ? buildEjsEntries(project.ejsConfig).worldbookEntries : undefined;
  return {
    validation,
    card: buildCharacterCardJson({
      config: project.characterCardConfig,
      worldbookEntries: project.draft,
      worldbookName: project.characterCardConfig.worldbook.name ?? project.name,
      mvuAssets,
      htmlAssets,
      ejsEntries,
    }),
  };
}
