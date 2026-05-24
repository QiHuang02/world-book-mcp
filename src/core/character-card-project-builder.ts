import type { Project } from "../schemas/project.js";
import { buildCharacterCardJson, type CharacterCardJson } from "./character-card-builder.js";
import { buildProjectAssets } from "./project-assets.js";

export function buildCharacterCardJsonFromProject(project: Project, extraRegexScripts: import("./mvu-assets.js").RegexScriptAsset[] = []): { card: CharacterCardJson } {
  if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
  const assets = buildProjectAssets(project, "all", extraRegexScripts);
  return {
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
