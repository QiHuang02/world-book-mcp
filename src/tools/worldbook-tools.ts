import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createCharacterBasicEntryTemplate, createCharacterPersonalityEntryTemplate, validateCharacterAppearanceDistinctiveness, validateCharacterEntryStructure } from "../core/character-templates.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { validateItemEntry } from "../core/item-entry-validator.js";
import { applyPatchToDraft, createPatch, previewPatch } from "../core/worldbook-patch.js";
import { importWorldbookFromFile } from "../core/worldbook-importer.js";
import { buildWorldbookJson } from "../core/worldbook-builder.js";
import { confirmWorldbookDraftComplete, createWorldbookDraftTemplate, updateWorldbookDraftField, updateWorldbookDraftFields } from "../core/worldbook-draft-editor.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { validateWorldbookDraft } from "../core/worldbook-validator.js";
import { createWorldbookEntryPlan, validateWorldbookEntryPlan } from "../core/worldbook-planning.js";
import { ConfirmWorldbookDraftCompleteInputSchema, CreateWorldbookDraftEntriesInputSchema, CreateWorldbookDraftEntryInputSchema, DeleteWorldbookDraftEntryInputSchema, EntryTypeSchema, GenerateWorldbookJsonInputSchema, GetWorldbookDraftEntryInputSchema, ListWorldbookDraftEntriesInputSchema, UpdateWorldbookDraftFieldInputSchema, UpdateWorldbookDraftFieldsInputSchema, ValidateWorldbookDraftInputSchema, type WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { ApplyWorldbookPatchInputSchema, CreateWorldbookPatchInputSchema, ImportWorldbookJsonInputSchema, PreviewWorldbookPatchInputSchema } from "../schemas/worldbook-patch.js";
import { resolveExportPath, resolveReadableWorldbookPath, writeTempThenCommit, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { deleteWorkspaceDraftEntry, draftEntryPath, initWorkspaceProject } from "../storage/workspace-store.js";
import { toPrettyJson } from "../utils/json.js";
import { toolText } from "./helpers.js";

export function registerWorldbookTools(server: McpServer): void {
  server.tool("create_character_basic_entry_template", { character_name: z.string().optional() }, async (input) => toolText(createCharacterBasicEntryTemplate(input)));

  server.tool("create_character_personality_entry_template", { character_name: z.string().optional() }, async (input) => toolText(createCharacterPersonalityEntryTemplate(input)));

  server.tool("validate_character_entry_structure", { content: z.string().min(1), kind: z.enum(["basic", "personality"]) }, async (input) => toolText(validateCharacterEntryStructure(input)));

  server.tool("validate_character_appearance_distinctiveness", { content: z.string().min(1) }, async (input) => toolText(validateCharacterAppearanceDistinctiveness(input.content)));

  server.tool("validate_item_entry", { content: z.string().min(1), item_kind: z.enum(["clothing", "special_item", "weapon", "ability", "equipment", "generic"]) }, async (input) => toolText(validateItemEntry(input)));

  server.tool("create_worldbook_entry_plan", {
    project_id: z.string().optional(),
    card_type: z.enum(["single_character_card", "multi_character_card", "worldbook_only"]),
    characters: z.array(z.object({ name: z.string().min(1), aliases: z.array(z.string()).optional() })).optional(),
    world_sections: z.array(z.string()).optional(),
    items: z.array(z.string()).optional(),
    scenes: z.array(z.string()).optional(),
    events: z.array(z.string()).optional(),
    include_style_entries: z.boolean().optional(),
    include_chapter_entries: z.boolean().optional(),
    save: z.boolean().default(false),
  }, async (input) => {
    const result = createWorldbookEntryPlan(input);
    if (input.project_id && input.save) {
      const project = await loadProject(input.project_id);
      await updateProject(input.project_id, (project) => ({ ...project, plan: result.entries_plan }));
    }
    return toolText({ project_id: input.project_id, saved: input.save, ...result, validation: validateWorldbookEntryPlan({ card_type: input.card_type, plan: result.entries_plan }) });
  });

  server.tool("validate_worldbook_entry_plan", { card_type: z.enum(["single_character_card", "multi_character_card", "worldbook_only"]), plan: z.array(z.object({ comment: z.string(), entryType: EntryTypeSchema, position: z.enum(["before_char", "after_char", "before_an", "after_an", "at_depth", "before_em", "after_em", "outlet"]), order: z.number(), constant: z.boolean(), keys: z.array(z.string()).default([]), reason: z.string() })) }, async (input) => toolText(validateWorldbookEntryPlan(input)));

  server.tool("create_worldbook_draft_entry", CreateWorldbookDraftEntryInputSchema.shape, async (input) => {
    const parsed = CreateWorldbookDraftEntryInputSchema.parse(input);
    const { project_id, expected_revision, if_exists, ...templateInput } = parsed;
    let savedEntry: WorldbookDraftEntry | undefined;
    let created = false;
    let overwritten = false;
    const result = await updateProject(project_id, (project) => {
      const draft = [...(project.draft ?? [])];
      const comment = templateInput.comment.trim();
      const index = draft.findIndex((entry) => entry.comment === comment);
      if (index >= 0 && if_exists === "error") throw new Error(`comment=${comment} 的 draft 已存在；如需复用请设置 if_exists=return_existing，如需覆盖请设置 if_exists=overwrite`);
      if (index >= 0 && if_exists === "return_existing") {
        savedEntry = draft[index];
        return project;
      }
      const entry = createWorldbookDraftTemplate(templateInput);
      if (index >= 0) {
        draft[index] = entry;
        overwritten = true;
      } else {
        draft.push(entry);
        created = true;
      }
      savedEntry = entry;
      return { ...project, draft };
    }, { expectedRevision: expected_revision });
    return toolText({
      ok: true,
      project_id,
      revision: result.revision,
      created,
      overwritten,
      entry: savedEntry,
      draft_path: savedEntry ? draftEntryPath(savedEntry.comment) : undefined,
      total_entry_count: result.draft?.length ?? 0,
      template_status: createTemplateStatus(savedEntry ? [savedEntry] : []),
    });
  });

  server.tool("create_worldbook_draft_entries", CreateWorldbookDraftEntriesInputSchema.shape, async (input) => {
    const parsed = CreateWorldbookDraftEntriesInputSchema.parse(input);
    const savedEntries: WorldbookDraftEntry[] = [];
    let createdCount = 0;
    let overwrittenCount = 0;
    const result = await updateProject(parsed.project_id, (project) => {
      const draft = [...(project.draft ?? [])];
      for (const templateInput of parsed.entries) {
        const comment = templateInput.comment.trim();
        const index = draft.findIndex((entry) => entry.comment === comment);
        if (index >= 0 && parsed.if_exists === "error") throw new Error(`comment=${comment} 的 draft 已存在；如需复用请设置 if_exists=return_existing，如需覆盖请设置 if_exists=overwrite`);
        if (index >= 0 && parsed.if_exists === "return_existing") {
          savedEntries.push(draft[index]);
          continue;
        }
        const entry = createWorldbookDraftTemplate(templateInput);
        if (index >= 0) {
          draft[index] = entry;
          overwrittenCount += 1;
        } else {
          draft.push(entry);
          createdCount += 1;
        }
        savedEntries.push(entry);
      }
      return { ...project, draft };
    }, { expectedRevision: parsed.expected_revision });
    return toolText({
      ok: true,
      project_id: parsed.project_id,
      revision: result.revision,
      created_count: createdCount,
      overwritten_count: overwrittenCount,
      saved_entry_count: savedEntries.length,
      total_entry_count: result.draft?.length ?? 0,
      draft_paths: savedEntries.map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) })),
      template_status: createTemplateStatus(savedEntries),
    });
  });

  server.tool("update_worldbook_draft_field", UpdateWorldbookDraftFieldInputSchema.shape, async (input) => {
    const parsed = UpdateWorldbookDraftFieldInputSchema.parse(input);
    let updatedEntry: WorldbookDraftEntry | undefined;
    let oldComment = parsed.comment;
    const result = await updateProject(parsed.project_id, (project) => {
      const draft = [...(project.draft ?? [])];
      const index = draft.findIndex((entry) => entry.comment === parsed.comment);
      if (index === -1) throw new Error(`未找到 comment=${parsed.comment} 的草稿条目，请先调用 create_worldbook_draft_entry 创建模板`);
      oldComment = draft[index].comment;
      updatedEntry = updateWorldbookDraftField(draft[index], parsed.field, parsed.value);
      ensureUniqueComment(draft, updatedEntry.comment, index);
      draft[index] = updatedEntry;
      return { ...project, draft };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateWorldbookDraft(result.draft ?? []);
    return toolText({ project_id: parsed.project_id, revision: result.revision, entry: updatedEntry, comment_change: buildCommentChange(oldComment, updatedEntry?.comment ?? oldComment), draft_path: updatedEntry ? draftEntryPath(updatedEntry.comment) : undefined, validation });
  });

  server.tool("update_worldbook_draft_fields", UpdateWorldbookDraftFieldsInputSchema.shape, async (input) => {
    const parsed = UpdateWorldbookDraftFieldsInputSchema.parse(input);
    let updatedEntry: WorldbookDraftEntry | undefined;
    let oldComment = parsed.comment;
    const result = await updateProject(parsed.project_id, (project) => {
      const draft = [...(project.draft ?? [])];
      const index = draft.findIndex((entry) => entry.comment === parsed.comment);
      if (index === -1) throw new Error(`未找到 comment=${parsed.comment} 的草稿条目，请先调用 create_worldbook_draft_entry 创建模板`);
      oldComment = draft[index].comment;
      updatedEntry = updateWorldbookDraftFields(draft[index], parsed.changes);
      ensureUniqueComment(draft, updatedEntry.comment, index);
      draft[index] = updatedEntry;
      return { ...project, draft };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateWorldbookDraft(result.draft ?? []);
    return toolText({ project_id: parsed.project_id, revision: result.revision, entry: updatedEntry, comment_change: buildCommentChange(oldComment, updatedEntry?.comment ?? oldComment), draft_path: updatedEntry ? draftEntryPath(updatedEntry.comment) : undefined, validation });
  });

  server.tool("confirm_worldbook_draft_complete", ConfirmWorldbookDraftCompleteInputSchema.shape, async (input) => {
    const parsed = ConfirmWorldbookDraftCompleteInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    return toolText(confirmWorldbookDraftComplete(project.draft));
  });

  server.tool("list_worldbook_draft_entries", ListWorldbookDraftEntriesInputSchema.shape, async (input) => {
    const parsed = ListWorldbookDraftEntriesInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const entries = project.draft ?? [];
    return toolText({
      project_id: project.id,
      entry_count: entries.length,
      entries: entries.map((entry) => ({
        comment: entry.comment,
        entryType: entry.entryType,
        keys: entry.keys,
        secondaryKeys: entry.secondaryKeys,
        constant: entry.constant,
        position: entry.position,
        order: entry.order,
        enabled: entry.enabled,
        characterName: entry.characterName,
        draft_path: draftEntryPath(entry.comment),
        content_length: entry.content.length,
        ...(parsed.include_content ? { content: entry.content } : {}),
      })),
    });
  });

  server.tool("get_worldbook_draft_entry", GetWorldbookDraftEntryInputSchema.shape, async (input) => {
    const parsed = GetWorldbookDraftEntryInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const entry = project.draft?.find((item) => item.comment === parsed.comment);
    if (!entry) throw new Error(`未找到 comment=${parsed.comment} 的草稿条目`);
    return toolText({ project_id: project.id, draft_path: draftEntryPath(entry.comment), entry });
  });

  server.tool("delete_worldbook_draft_entry", DeleteWorldbookDraftEntryInputSchema.shape, async (input) => {
    const parsed = DeleteWorldbookDraftEntryInputSchema.parse(input);
    let deletedPath: string | undefined;
    const result = await updateProject(parsed.project_id, async (project) => {
      const draft = project.draft ?? [];
      const next = draft.filter((entry) => entry.comment !== parsed.comment);
      if (next.length === draft.length) throw new Error(`未找到 comment=${parsed.comment} 的草稿条目`);
      deletedPath = await deleteWorkspaceDraftEntry(parsed.comment);
      return { ...project, draft: next };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateWorldbookDraft(result.draft ?? []);
    return toolText({ project_id: result.id, revision: result.revision, deleted: true, deleted_path: deletedPath, total_entry_count: result.draft?.length ?? 0, validation });
  });

  server.tool("validate_worldbook_draft", ValidateWorldbookDraftInputSchema.shape, async (input) => {
    const parsed = ValidateWorldbookDraftInputSchema.parse(input);
    const entries = parsed.entries ?? (parsed.project_id ? (await loadProject(parsed.project_id)).draft : undefined);
    if (!entries) throw new Error("需要传入 entries 或提供已有 draft 的 project_id");
    return toolText(validateWorldbookDraft(entries));
  });

  server.tool("generate_worldbook_json", GenerateWorldbookJsonInputSchema.shape, async (input) => {
    const parsed = GenerateWorldbookJsonInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
    const completeness = confirmWorldbookDraftComplete(project.draft);
    if (!completeness.ready_to_merge) return toolText({ ok: false, completeness });
    if (parsed.strict_review) {
      const checklist = createDeliveryChecklist({ project, export_target: "worldbook" });
      if (!checklist.ready_to_export) return toolText({ ok: false, error: "strict_review 未通过", checklist });
    }
    const book = buildWorldbookJson({ name: parsed.worldbook_name, entries: project.draft });
    const outputPath = resolveExportPath(parsed.output_path, parsed.worldbook_name);
    try {
      await writeTextFileSafely(outputPath, toPrettyJson(book), { overwrite: parsed.overwrite });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath });
      throw error;
    }
    return toolText({ ok: true, path: outputPath, worldbook_name: book.name, entry_count: Object.keys(book.entries).length });
  });

  server.tool("import_worldbook_json", ImportWorldbookJsonInputSchema.shape, async (input) => {
    const parsed = ImportWorldbookJsonInputSchema.parse(input);
    const sourcePath = resolveReadableWorldbookPath(parsed.path);
    const { book, draft } = await importWorldbookFromFile(sourcePath);
    const validation = validateWorldbookDraft(draft);
    if (!validation.valid) return toolText({ ok: false, worldbook_name: book.name, entry_count: draft.length, validation });
    const project = parsed.project_id
      ? await loadProject(parsed.project_id)
      : (await initWorkspaceProject({ name: parsed.project_name ?? book.name, ifExists: parsed.if_exists })).project;
    const saved = await updateProject(project.id, (latest) => ({ ...latest, name: parsed.project_name ?? book.name, draft, importedWorldbookPath: sourcePath }));
    const draftPaths = (saved.draft ?? []).map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) }));
    return toolText({
      ok: true,
      project_id: saved.id,
      revision: saved.revision,
      worldbook_name: book.name,
      entry_count: draft.length,
      draft_dir: draftPaths.length > 0 ? draftPaths[0].path.replace(/[\\/][^\\/]+$/, "") : undefined,
      draft_paths: draftPaths,
      draft_retained: true,
      workflow: "已将外部世界书 JSON 切片为 .worldbook/draft/*.json；后续请修改 draft 后再合并导出。",
      validation,
    });
  });

  server.tool("create_worldbook_patch", CreateWorldbookPatchInputSchema.shape, async (input) => {
    const parsed = CreateWorldbookPatchInputSchema.parse(input);
    let patch: ReturnType<typeof createPatch> | undefined;
    let preview: ReturnType<typeof previewPatch> | undefined;
    const saved = await updateProject(parsed.project_id, (project) => {
      if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
      patch = createPatch({ projectId: project.id, sourcePath: project.importedWorldbookPath, operations: parsed.operations });
      preview = previewPatch(project, patch);
      return { ...project, patches: [...(project.patches ?? []), patch] };
    });
    return toolText({ project_id: saved.id, patch_id: patch!.id, operation_count: patch!.operations.length, validation: preview!.validation });
  });

  server.tool("preview_worldbook_patch", PreviewWorldbookPatchInputSchema.shape, async (input) => {
    const parsed = PreviewWorldbookPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const patch = project.patches?.find((item) => item.id === parsed.patch_id);
    if (!patch) throw new Error(`未找到 patch_id=${parsed.patch_id}`);
    const preview = previewPatch(project, patch);
    return toolText({ project_id: project.id, patch_id: patch.id, diff: preview.diff, validation: preview.validation });
  });

  server.tool("apply_worldbook_patch", ApplyWorldbookPatchInputSchema.shape, async (input) => {
    const parsed = ApplyWorldbookPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
    const patch = project.patches?.find((item) => item.id === parsed.patch_id);
    if (!patch) throw new Error(`未找到 patch_id=${parsed.patch_id}`);
    const applied = applyPatchToDraft(project.draft, patch.operations);
    const validation = validateWorldbookDraft(applied.entries);
    if (!validation.valid) return toolText({ ok: false, validation, diff: applied.diff });
    const outputPath = resolveExportPath(parsed.output_path, project.name);
    let backupPath: string | undefined;
    const book = buildWorldbookJson({ name: project.name, entries: applied.entries });
    try {
      const writeResult = await writeTempThenCommit({
        targetPath: outputPath,
        content: toPrettyJson(book),
        tempId: patch.id,
        overwrite: parsed.overwrite,
        backup: parsed.backup,
        commit: async () => {
          await updateProject(project.id, (latest) => ({ ...latest, draft: applied.entries, importedWorldbookPath: outputPath }), { expectedRevision: project.revision });
        },
      });
      backupPath = writeResult.backupPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath, backupPath });
      throw error;
    }
    const saved = await loadProject(project.id);
    const draftPaths = (saved.draft ?? []).map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) }));
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, patch_id: patch.id, path: outputPath, backupPath, diff: applied.diff, entry_count: applied.entries.length, draft_paths: draftPaths, draft_retained: true });
  });

  server.tool("query_worldbook", { path: z.string().min(1), mode: z.enum(["brief", "uid", "search", "stats"]), uid: z.number().int().optional(), query: z.string().optional() }, async (input) => toolText(await queryWorldbook(input)));
}

function createTemplateStatus(entries: WorldbookDraftEntry[]): { template_ready: true; needs_content: boolean; next_actions: Array<{ tool: "update_worldbook_draft_field"; comment: string; field: "content" }> } {
  const emptyContentEntries = entries.filter((entry) => !entry.content.trim());
  return {
    template_ready: true,
    needs_content: emptyContentEntries.length > 0,
    next_actions: emptyContentEntries.map((entry) => ({ tool: "update_worldbook_draft_field", comment: entry.comment, field: "content" })),
  };
}

function buildCommentChange(oldComment: string, newComment: string): { changed: boolean; old_comment: string; new_comment: string } {
  return { changed: oldComment !== newComment, old_comment: oldComment, new_comment: newComment };
}

function ensureUniqueComment(entries: WorldbookDraftEntry[], comment: string, currentIndex: number): void {
  const duplicateIndex = entries.findIndex((entry, index) => index !== currentIndex && entry.comment === comment);
  if (duplicateIndex >= 0) throw new Error(`comment=${comment} 已被其他草稿条目使用，请使用唯一 comment`);
}
