import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCharacterCardJsonFromProject } from "../core/character-card-project-builder.js";
import { importCharacterCardFromFile } from "../core/character-card-importer.js";
import { applyCharacterCardPatchToProject, createCharacterCardPatch, previewCharacterCardPatch } from "../core/character-card-patch.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { validateCharacterCardConfig } from "../core/character-card-validator.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { validateGreetings } from "../core/greeting-validator.js";
import { ApplyCharacterCardPatchInputSchema, CharacterCardConfigSchema, CreateCharacterCardPatchInputSchema, GenerateCharacterCardJsonInputSchema, ImportCharacterCardJsonInputSchema, PreviewCharacterCardPatchInputSchema, QueryCharacterCardInputSchema, UpsertCharacterProfileInputSchema, ValidateCharacterCardConfigInputSchema } from "../schemas/character-card.js";
import { resolveCardExportPath, resolveReadableCardPath, writeTempThenCommit, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { initWorkspaceProject } from "../storage/workspace-store.js";
import { toPrettyJson } from "../utils/json.js";
import { toolText } from "./helpers.js";

export function registerCharacterCardTools(server: McpServer): void {
  server.tool("import_character_card_json", ImportCharacterCardJsonInputSchema.shape, async (input) => {
    const parsed = ImportCharacterCardJsonInputSchema.parse(input);
    const sourcePath = resolveReadableCardPath(parsed.path);
    const { config, draft } = await importCharacterCardFromFile(sourcePath);
    const validation = validateCharacterCardConfig({ config, draft });
    if (!validation.valid) return toolText({ ok: false, validation });
    const project = parsed.project_id
      ? await loadProject(parsed.project_id)
      : (await initWorkspaceProject({ name: parsed.project_name ?? config.card.name, ifExists: parsed.if_exists })).project;
    const saved = await updateProject(project.id, (latest) => ({
      ...latest,
      name: parsed.project_name ?? config.card.name,
      characterCardConfig: config,
      draft,
      importedCharacterCardPath: sourcePath,
    }));
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, name: config.card.name, worldbook_entry_count: draft.length, validation });
  });

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
    const { card, validation } = buildCharacterCardJsonFromProject(project);
    if (!validation.valid) return toolText({ ok: false, validation });
    if (parsed.strict_review) {
      const checklist = createDeliveryChecklist({ project, export_target: "character_card" });
      if (!checklist.ready_to_export) return toolText({ ok: false, error: "strict_review 未通过", checklist });
    }
    const outputPath = resolveCardExportPath(parsed.output_path, project.characterCardConfig.card.name);
    try {
      await writeTextFileSafely(outputPath, toPrettyJson(card), { overwrite: parsed.overwrite });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath });
      throw error;
    }
    return toolText({ ok: true, path: outputPath, name: card.name, worldbook_entry_count: card.data.character_book.entries.length });
  });

  server.tool("create_character_card_patch", CreateCharacterCardPatchInputSchema.shape, async (input) => {
    const parsed = CreateCharacterCardPatchInputSchema.parse(input);
    let patch: ReturnType<typeof createCharacterCardPatch> | undefined;
    let preview: ReturnType<typeof previewCharacterCardPatch> | undefined;
    const saved = await updateProject(parsed.project_id, (project) => {
      if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
      patch = createCharacterCardPatch({ projectId: project.id, sourcePath: project.importedCharacterCardPath, operations: parsed.operations });
      preview = previewCharacterCardPatch(project, patch);
      return { ...project, characterCardPatches: [...(project.characterCardPatches ?? []), patch] };
    });
    return toolText({ project_id: saved.id, revision: saved.revision, patch_id: patch!.id, operation_count: patch!.operations.length, validation: preview!.validation });
  });

  server.tool("preview_character_card_patch", PreviewCharacterCardPatchInputSchema.shape, async (input) => {
    const parsed = PreviewCharacterCardPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const patch = project.characterCardPatches?.find((item) => item.id === parsed.patch_id);
    if (!patch) throw new Error(`未找到 patch_id=${parsed.patch_id}`);
    const preview = previewCharacterCardPatch(project, patch);
    return toolText({ project_id: project.id, patch_id: patch.id, diff: preview.diff, validation: preview.validation });
  });

  server.tool("apply_character_card_patch", ApplyCharacterCardPatchInputSchema.shape, async (input) => {
    const parsed = ApplyCharacterCardPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const patch = project.characterCardPatches?.find((item) => item.id === parsed.patch_id);
    if (!patch) throw new Error(`未找到 patch_id=${parsed.patch_id}`);
    const applied = applyCharacterCardPatchToProject(project, patch.operations);
    if (!applied.validation.valid) return toolText({ ok: false, validation: applied.validation, diff: applied.diff });
    if (!applied.project.characterCardConfig) throw new Error("项目尚未保存 character card config");
    const outputPath = resolveCardExportPath(parsed.output_path, applied.project.characterCardConfig.card.name);
    let backupPath: string | undefined;
    const { card, validation: buildValidation } = buildCharacterCardJsonFromProject(applied.project);
    if (!buildValidation.valid) return toolText({ ok: false, validation: buildValidation, diff: applied.diff });
    try {
      const writeResult = await writeTempThenCommit({
        targetPath: outputPath,
        content: toPrettyJson(card),
        tempId: patch.id,
        overwrite: parsed.overwrite,
        backup: parsed.backup,
        commit: async () => {
          await updateProject(parsed.project_id, (latest) => {
            if (latest.revision !== project.revision) throw new Error(`project revision conflict: expected ${project.revision}, current ${latest.revision}`);
            return { ...latest, characterCardConfig: applied.project.characterCardConfig, draft: applied.project.draft, importedCharacterCardPath: outputPath };
          });
        },
      });
      backupPath = writeResult.backupPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath, backupPath });
      throw error;
    }
    const saved = await loadProject(parsed.project_id);
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, patch_id: patch.id, path: outputPath, backupPath, diff: applied.diff, worldbook_entry_count: card.data.character_book.entries.length });
  });

  server.tool("query_character_card", QueryCharacterCardInputSchema.shape, async (input) => {
    const parsed = QueryCharacterCardInputSchema.parse(input);
    return toolText(await queryCharacterCard(parsed));
  });
}
