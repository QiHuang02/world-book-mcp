import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCharacterCardJson } from "../core/character-card-builder.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { validateCharacterCardConfig } from "../core/character-card-validator.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { buildEjsEntries } from "../core/ejs-entries.js";
import { validateEjsConfig } from "../core/ejs-validator.js";
import { validateGreetings } from "../core/greeting-validator.js";
import { buildHtmlBeautifyAssets } from "../core/html-beautify-assets.js";
import { validateHtmlBeautifyConfig } from "../core/html-beautify-validator.js";
import { buildMvuAssets } from "../core/mvu-assets.js";
import { validateMvuConfig } from "../core/mvu-validator.js";
import { CharacterCardConfigSchema, GenerateCharacterCardJsonInputSchema, QueryCharacterCardInputSchema, UpsertCharacterProfileInputSchema, ValidateCharacterCardConfigInputSchema } from "../schemas/character-card.js";
import { resolveCardExportPath, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { toPrettyJson } from "../utils/json.js";
import { toolText } from "./helpers.js";

export function registerCharacterCardTools(server: McpServer): void {
  server.tool("upsert_character_profile", UpsertCharacterProfileInputSchema.shape, async (input) => {
    const parsed = UpsertCharacterProfileInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      const existingCard = project.characterCardConfig?.card;
      const includeWorldbook = parsed.include_worldbook ?? project.characterCardConfig?.worldbook.source !== "none";
      const card = CharacterCardConfigSchema.parse({
        card: {
          name: parsed.name,
          description: parsed.description ?? existingCard?.description ?? "",
          personality: parsed.personality ?? existingCard?.personality ?? "",
          scenario: parsed.scenario ?? existingCard?.scenario ?? "",
          first_mes: parsed.first_mes ?? existingCard?.first_mes ?? "",
          alternate_greetings: parsed.alternate_greetings ?? existingCard?.alternate_greetings ?? [],
          creator_notes: parsed.creator_notes ?? existingCard?.creator_notes ?? "",
          system_prompt: parsed.system_prompt ?? existingCard?.system_prompt ?? "",
          post_history_instructions: parsed.post_history_instructions ?? existingCard?.post_history_instructions ?? "",
          tags: parsed.tags ?? existingCard?.tags ?? [],
          creator: parsed.creator ?? existingCard?.creator ?? "",
          character_version: parsed.character_version ?? existingCard?.character_version ?? "1.0",
          talkativeness: parsed.talkativeness ?? existingCard?.talkativeness ?? "0.5",
        },
        worldbook: {
          source: includeWorldbook ? "project_draft" : "none",
          name: parsed.worldbook_name ?? project.characterCardConfig?.worldbook.name ?? parsed.name,
        },
      });
      return { ...project, characterCardConfig: card };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateCharacterCardConfig({ config: result.characterCardConfig!, draft: result.draft, mvuEnabled: result.mvuConfig?.enabled });
    return toolText({ project_id: result.id, revision: result.revision, validation });
  });

  server.tool("validate_character_card_config", ValidateCharacterCardConfigInputSchema.shape, async (input) => {
    const parsed = ValidateCharacterCardConfigInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const config = parsed.config ?? project.characterCardConfig;
    if (!config) throw new Error("项目尚未保存 character card config");
    return toolText(validateCharacterCardConfig({ config, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled }));
  });

  server.tool("validate_greetings", { project_id: z.string(), config: CharacterCardConfigSchema.optional(), mvu_enabled: z.boolean().optional() }, async (input) => {
    const project = await loadProject(input.project_id);
    const config = input.config ?? project.characterCardConfig;
    if (!config) throw new Error("项目尚未保存 character card config");
    return toolText(validateGreetings({ config, mvu_enabled: input.mvu_enabled ?? project.mvuConfig?.enabled }));
  });

  server.tool("generate_character_card_json", GenerateCharacterCardJsonInputSchema.shape, async (input) => {
    const parsed = GenerateCharacterCardJsonInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
    const validation = validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled });
    if (!validation.valid) return toolText({ ok: false, validation });
    const mvuValidation = project.mvuConfig?.enabled ? validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : undefined;
    if (mvuValidation && !mvuValidation.valid) return toolText({ ok: false, validation: mvuValidation });
    const mvuAssets = project.mvuConfig?.enabled ? buildMvuAssets(project.mvuConfig) : undefined;
    const htmlValidation = project.htmlBeautifyConfig?.enabled ? validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig }) : undefined;
    if (htmlValidation && !htmlValidation.valid) return toolText({ ok: false, validation: htmlValidation });
    const htmlAssets = project.htmlBeautifyConfig?.enabled ? buildHtmlBeautifyAssets(project.htmlBeautifyConfig) : undefined;
    const ejsValidation = project.ejsConfig?.enabled ? validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig }) : undefined;
    if (ejsValidation && !ejsValidation.valid) return toolText({ ok: false, validation: ejsValidation });
    const ejsEntries = project.ejsConfig?.enabled ? buildEjsEntries(project.ejsConfig).worldbookEntries : undefined;
    if (parsed.strict_review) {
      const checklist = createDeliveryChecklist({ project, export_target: "character_card" });
      if (!checklist.ready_to_export) return toolText({ ok: false, error: "strict_review 未通过", checklist });
    }
    const card = buildCharacterCardJson({
      config: project.characterCardConfig,
      worldbookEntries: project.draft,
      worldbookName: project.characterCardConfig.worldbook.name ?? project.name,
      mvuAssets,
      htmlAssets,
      ejsEntries,
    });
    const outputPath = resolveCardExportPath(parsed.output_path, project.characterCardConfig.card.name);
    try {
      await writeTextFileSafely(outputPath, toPrettyJson(card), { overwrite: parsed.overwrite });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath });
      throw error;
    }
    return toolText({ ok: true, path: outputPath, name: card.name, worldbook_entry_count: card.data.character_book.entries.length });
  });

  server.tool("query_character_card", QueryCharacterCardInputSchema.shape, async (input) => {
    const parsed = QueryCharacterCardInputSchema.parse(input);
    return toolText(await queryCharacterCard(parsed));
  });
}
