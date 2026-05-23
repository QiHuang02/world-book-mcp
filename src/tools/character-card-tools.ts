import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCharacterCardJsonFromProject } from "../core/character-card-project-builder.js";
import { importCharacterCardFromFile } from "../core/character-card-importer.js";
import { applyCharacterCardPatchToProject, createCharacterCardPatch, previewCharacterCardPatch } from "../core/character-card-patch.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { validateCharacterCardConfig } from "../core/character-card-validator.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { validateGreetings } from "../core/greeting-validator.js";
import { confirmWorldbookDraftComplete } from "../core/worldbook-draft-editor.js";
import { ApplyCharacterCardPatchInputSchema, CharacterCardConfigSchema, CreateCharacterCardPatchInputSchema, GenerateCharacterCardJsonInputSchema, ImportCharacterCardJsonInputSchema, PreviewCharacterCardPatchInputSchema, QueryCharacterCardInputSchema, UpsertCharacterProfileInputSchema, ValidateCharacterCardConfigInputSchema } from "../schemas/character-card.js";
import type { Project } from "../schemas/project.js";
import { resolveCardExportPath, resolveReadableCardPath, writeTempThenCommit, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { draftEntryPath, initWorkspaceProject } from "../storage/workspace-store.js";
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
    const draftPaths = (saved.draft ?? []).map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) }));
    return toolText({
      ok: true,
      project_id: saved.id,
      revision: saved.revision,
      name: config.card.name,
      worldbook_entry_count: draft.length,
      draft_paths: draftPaths,
      draft_retained: true,
      workflow: "已将角色卡内嵌世界书切片为 .worldbook/draft/*.json；后续请修改 draft 后再合并导出角色卡。",
      validation,
    });
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

  server.tool("confirm_character_card_draft_complete", { project_id: z.string() }, async (input) => {
    const project = await loadProject(input.project_id);
    return toolText(confirmCharacterCardDraftComplete(project));
  });

  server.tool("generate_character_card_json", GenerateCharacterCardJsonInputSchema.shape, async (input) => {
    const parsed = GenerateCharacterCardJsonInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const completeness = confirmCharacterCardDraftComplete(project);
    if (!completeness.ready_to_merge) return toolText({ ok: false, completeness });
    if (!project.characterCardConfig) throw new Error("项目尚未保存 character card config");
    const { card, validation } = buildCharacterCardJsonFromProject(project);
    if (!validation.valid) return toolText({ ok: false, completeness, validation });
    if (parsed.strict_review) {
      const checklist = createDeliveryChecklist({ project, export_target: "character_card" });
      if (!checklist.ready_to_export) return toolText({ ok: false, error: "strict_review 未通过", completeness, checklist });
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
    const draftPaths = (saved.draft ?? []).map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) }));
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, patch_id: patch.id, path: outputPath, backupPath, diff: applied.diff, worldbook_entry_count: card.data.character_book.entries.length, draft_paths: draftPaths, draft_retained: true });
  });

  server.tool("query_character_card", QueryCharacterCardInputSchema.shape, async (input) => {
    const parsed = QueryCharacterCardInputSchema.parse(input);
    return toolText(await queryCharacterCard(parsed));
  });
}

interface CharacterCardCompletenessIssue {
  field: string;
  message: string;
  comment?: string;
}

type CharacterCardNextAction = { tool: "upsert_character_profile" | "create_worldbook_draft_entry" | "update_worldbook_draft_field"; comment?: string; field?: string };

function confirmCharacterCardDraftComplete(project: Project): {
  ok: boolean;
  ready_to_merge: boolean;
  profile_ready: boolean;
  worldbook_ready: boolean;
  asset_ready: true;
  missing_fields: CharacterCardCompletenessIssue[];
  next_actions: CharacterCardNextAction[];
  validation?: ReturnType<typeof validateCharacterCardConfig>;
  worldbook?: ReturnType<typeof confirmWorldbookDraftComplete>;
} {
  if (!project.characterCardConfig) {
    return {
      ok: false,
      ready_to_merge: false,
      profile_ready: false,
      worldbook_ready: true,
      asset_ready: true,
      missing_fields: [{ field: "characterCardConfig", message: "项目尚未保存 character card config" }],
      next_actions: [{ tool: "upsert_character_profile" }],
    };
  }

  const validation = validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled });
  const worldbook = project.characterCardConfig.worldbook.source === "project_draft" ? confirmWorldbookDraftComplete(project.draft) : undefined;
  const missingFields: CharacterCardCompletenessIssue[] = [];
  const nextActions: CharacterCardNextAction[] = [];
  const addMissing = (issue: CharacterCardCompletenessIssue) => {
    const exists = missingFields.some((current) => current.field === issue.field && current.comment === issue.comment);
    if (!exists) missingFields.push(issue);
  };

  if (!project.characterCardConfig.card.first_mes.trim()) {
    addMissing({ field: "first_mes", message: "first_mes 为空，角色卡不能合并导出" });
    nextActions.push({ tool: "upsert_character_profile", field: "first_mes" });
  }
  for (const issue of validation.errors) {
    addMissing({ field: issue.field ?? "validation", message: issue.message, comment: issue.entry });
  }
  if (worldbook && !worldbook.ready_to_merge) {
    for (const issue of worldbook.missing_fields) addMissing({ ...issue, field: `worldbook.${issue.field}` });
    nextActions.push(...worldbook.next_actions.map((action) => ({ ...action, field: action.field, tool: action.tool })));
  }

  const profileReady = validation.valid && project.characterCardConfig.card.first_mes.trim().length > 0;
  const ready = validation.valid && missingFields.length === 0;
  return { ok: ready, ready_to_merge: ready, profile_ready: profileReady, worldbook_ready: worldbook?.ready_to_merge ?? true, asset_ready: true, missing_fields: missingFields, next_actions: dedupeNextActions(nextActions), validation, worldbook };
}

function dedupeNextActions<T extends { tool: string; comment?: string; field?: string }>(actions: T[]): T[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.tool}:${action.comment ?? ""}:${action.field ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
