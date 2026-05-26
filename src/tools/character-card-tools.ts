import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyCharacterGreetingsUpdate, applyCharacterProfileUpdate, CharacterGreetingsChangesSchema, CharacterProfileChangesSchema } from "../core/character-card-project-editor.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { updateProject } from "../storage/project-store.js";
import { resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

const UpdateCharacterProfileInputSchema = z.object({
  project_id: z.string(),
  changes: CharacterProfileChangesSchema,
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

const UpdateCharacterGreetingsInputSchema = z.object({
  project_id: z.string(),
  changes: CharacterGreetingsChangesSchema,
  expected_revision: z.number().int().nonnegative().optional(),
  expected_project_revision: z.number().int().nonnegative().optional(),
});

export function registerCharacterCardTools(server: McpServer): void {
  server.tool("update_character_profile", UpdateCharacterProfileInputSchema.shape, async (input) => toolText(await logToolCall("update_character_profile", input, async () => {
    const parsed = UpdateCharacterProfileInputSchema.parse(input);
    const saved = await updateProject(parsed.project_id, (project) => applyCharacterProfileUpdate(project, parsed.changes), { expectedRevision: resolveExpectedProjectRevision(parsed) });
    const { project } = await hydrateProjectDraft(saved);
    return {
      ok: true,
      project_id: parsed.project_id,
      revision: saved.revision,
      version: versionSnapshot({ project: saved }),
      profile: saved.profile,
      character_card_summary: project.characterCardConfig ? {
        name: project.characterCardConfig.card.name,
        include_worldbook: project.characterCardConfig.worldbook.source === "project_draft",
        worldbook_name: project.characterCardConfig.worldbook.name,
        first_mes_chars: project.characterCardConfig.card.first_mes.length,
        alternate_greeting_count: project.characterCardConfig.card.alternate_greetings.length,
      } : undefined,
      next_tools: ["update_character_greetings", "validate_draft(scope='character_card')"],
    };
  })));

  server.tool("update_character_greetings", UpdateCharacterGreetingsInputSchema.shape, async (input) => toolText(await logToolCall("update_character_greetings", input, async () => {
    const parsed = UpdateCharacterGreetingsInputSchema.parse(input);
    const saved = await updateProject(parsed.project_id, (project) => applyCharacterGreetingsUpdate(project, parsed.changes), { expectedRevision: resolveExpectedProjectRevision(parsed) });
    const { project } = await hydrateProjectDraft(saved);
    return {
      ok: true,
      project_id: parsed.project_id,
      revision: saved.revision,
      version: versionSnapshot({ project: saved }),
      greetings: saved.greetings,
      character_card_summary: project.characterCardConfig ? {
        name: project.characterCardConfig.card.name,
        first_mes_chars: project.characterCardConfig.card.first_mes.length,
        alternate_greeting_count: project.characterCardConfig.card.alternate_greetings.length,
      } : undefined,
      next_tools: ["validate_draft(scope='character_card')", "validate_draft(scope='content')"],
    };
  })));
}
