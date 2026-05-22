import type { Project } from "../schemas/project.js";
import type { CharacterCardPatch, CharacterCardPatchOperation } from "../schemas/character-card.js";
import { CharacterCardConfigSchema } from "../schemas/character-card.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { createId, nowIso } from "../utils/ids.js";
import { applyPatchToDraft, type PatchDiffItem } from "./worldbook-patch.js";
import { validateCharacterCardConfig } from "./character-card-validator.js";

export interface CharacterCardPatchPreview {
  project: Project;
  diff: PatchDiffItem[];
  validation: ReturnType<typeof validateCharacterCardConfig>;
}

export function createCharacterCardPatch(input: { projectId: string; sourcePath?: string; operations: CharacterCardPatchOperation[] }): CharacterCardPatch {
  return {
    id: createId("card_patch"),
    projectId: input.projectId,
    sourcePath: input.sourcePath,
    operations: input.operations,
    createdAt: nowIso(),
  };
}

export function previewCharacterCardPatch(project: Project, patch: CharacterCardPatch): CharacterCardPatchPreview {
  return applyCharacterCardPatchToProject(project, patch.operations);
}

export function applyCharacterCardPatchToProject(project: Project, operations: CharacterCardPatchOperation[]): CharacterCardPatchPreview {
  if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
  let next: Project = {
    ...project,
    characterCardConfig: {
      card: { ...project.characterCardConfig.card, alternate_greetings: [...project.characterCardConfig.card.alternate_greetings], tags: [...project.characterCardConfig.card.tags] },
      worldbook: { ...project.characterCardConfig.worldbook },
    },
    draft: project.draft ? cloneDraft(project.draft) : project.draft,
  };
  const diff: PatchDiffItem[] = [];

  for (const operation of operations) {
    switch (operation.op) {
      case "update_profile": {
        const before = next.characterCardConfig!.card;
        const after = CharacterCardConfigSchema.shape.card.parse({ ...before, ...operation.changes });
        next = { ...next, characterCardConfig: { ...next.characterCardConfig!, card: after } };
        diff.push({ op: "update_entry", target: "character_card.profile", before, after });
        break;
      }
      case "update_worldbook_config": {
        const before = next.characterCardConfig!.worldbook;
        const after = CharacterCardConfigSchema.shape.worldbook.parse({ ...before, ...operation.changes });
        next = { ...next, characterCardConfig: { ...next.characterCardConfig!, worldbook: after } };
        diff.push({ op: "update_entry", target: "character_card.worldbook", before, after });
        break;
      }
      case "worldbook_patch": {
        const applied = applyPatchToDraft(next.draft ?? [], [operation.operation]);
        next = { ...next, draft: applied.entries };
        diff.push(...applied.diff);
        break;
      }
    }
  }

  const validation = validateCharacterCardConfig({ config: next.characterCardConfig!, draft: next.draft, mvuEnabled: next.mvuConfig?.enabled });
  return { project: next, diff, validation };
}

function cloneDraft(entries: WorldbookDraftEntry[]): WorldbookDraftEntry[] {
  return entries.map((entry) => ({ ...entry, keys: [...entry.keys], secondaryKeys: [...entry.secondaryKeys] }));
}
