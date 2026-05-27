import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applyCharacterGreetingsUpdate, applyCharacterProfileUpdate } from "../core/character-card-project-editor.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";
import { UpdateCharacterGreetingsInputSchema, UpdateCharacterProfileInputSchema } from "./character-card-tool-schemas.js";

export function registerCharacterCardTools(server: McpServer): void {
  server.tool("update_character_profile", UpdateCharacterProfileInputSchema.shape, async (input) => toolText(await logToolCall("update_character_profile", input, async () => {
    const updated = await updateProject(input.project_id, (project) => applyCharacterProfileUpdate(project, input.changes), { expectedRevision: resolveExpectedProjectRevision(input) });
    return { ok: true, project_id: input.project_id, profile: updated.profile, version: versionSnapshot({ project: updated }), next_tools: ["update_character_greetings", "validate_project(scope='character_card')"] };
  })));

  server.tool("update_character_greetings", UpdateCharacterGreetingsInputSchema.shape, async (input) => toolText(await logToolCall("update_character_greetings", input, async () => {
    const updated = await updateProject(input.project_id, (project) => applyCharacterGreetingsUpdate(project, input.changes), { expectedRevision: resolveExpectedProjectRevision(input) });
    return { ok: true, project_id: input.project_id, greetings: updated.greetings, version: versionSnapshot({ project: updated }), next_tools: ["validate_project(scope='character_card')", "validate_project(scope='opening')"] };
  })));
}
