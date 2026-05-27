import type { Project } from "../schemas/project.js";
import { CharacterCardConfigSchema } from "../schemas/character-card.js";
import { buildCharacterCardJson, type CharacterCardJson } from "./character-card-builder.js";
import type { RegexScriptAsset, TavernHelperScriptAsset } from "./mvu-assets.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export function characterCardConfigFromProject(project: Project) {
  if (!project.profile) throw new Error("项目尚未保存角色卡 profile");
  return CharacterCardConfigSchema.parse({ card: { ...project.profile, ...(project.greetings ?? {}) }, worldbook: { source: project.profile.include_worldbook === false ? "none" : "project_draft", name: project.profile.worldbook_name ?? project.profile.name } });
}

export function buildCharacterCardJsonFromProject(project: Project & { draft?: WorldbookDraftEntry[] }, assets: { regexScripts?: RegexScriptAsset[]; tavernHelperScripts?: TavernHelperScriptAsset[]; worldbookEntries?: WorldbookDraftEntry[]; ejsEntries?: WorldbookDraftEntry[] } = {}): { card: CharacterCardJson } {
  const config = characterCardConfigFromProject(project);
  return { card: buildCharacterCardJson({ config, worldbookEntries: [...(project.draft ?? []), ...(assets.worldbookEntries ?? [])], worldbookName: config.worldbook.name ?? project.name, mvuAssets: { worldbookEntries: [], regexScripts: assets.regexScripts ?? [], tavernHelperScripts: assets.tavernHelperScripts ?? [] }, ejsEntries: assets.ejsEntries ?? [] }) };
}
