import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createCharacterBasicEntryTemplate, createCharacterPersonalityEntryTemplate, validateCharacterAppearanceDistinctiveness, validateCharacterEntryStructure } from "../core/character-templates.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { validateItemEntry } from "../core/item-entry-validator.js";
import { applyPatchToDraft, createPatch, previewPatch } from "../core/worldbook-patch.js";
import { importWorldbookFromFile } from "../core/worldbook-importer.js";
import { buildWorldbookJson } from "../core/worldbook-builder.js";
import { upsertWorldbookDraftEntry } from "../core/worldbook-entry-factory.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { validateWorldbookDraft } from "../core/worldbook-validator.js";
import { createWorldbookEntryPlan, validateWorldbookEntryPlan } from "../core/worldbook-planning.js";
import { DeleteWorldbookDraftEntryInputSchema, EntryTypeSchema, GenerateWorldbookJsonInputSchema, GetWorldbookDraftEntryInputSchema, ListWorldbookDraftEntriesInputSchema, UpsertWorldbookEntriesInputSchema, UpsertWorldbookEntryInputSchema, ValidateWorldbookDraftInputSchema } from "../schemas/worldbook-draft.js";
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

  server.tool("upsert_worldbook_entry", UpsertWorldbookEntryInputSchema.shape, async (input) => {
    const parsed = UpsertWorldbookEntryInputSchema.parse(input);
    const { project_id, expected_revision, match_by_keys, ...entryInput } = parsed;
    let upserted: ReturnType<typeof upsertWorldbookDraftEntry> | undefined;
    const result = await updateProject(project_id, (project) => {
      upserted = upsertWorldbookDraftEntry(project.draft, entryInput, { matchByKeys: match_by_keys });
      return { ...project, draft: upserted.entries };
    }, { expectedRevision: expected_revision });
    const validation = validateWorldbookDraft(result.draft ?? []);
    return toolText({ project_id, revision: result.revision, created: upserted?.created, index: upserted?.index, entry: upserted?.entry, draft_path: upserted?.entry ? draftEntryPath(upserted.entry.comment) : undefined, total_entry_count: result.draft?.length ?? 0, validation });
  });

  server.tool("upsert_worldbook_entries", UpsertWorldbookEntriesInputSchema.shape, async (input) => {
    const parsed = UpsertWorldbookEntriesInputSchema.parse(input);
    const result = await updateProject(parsed.project_id, (project) => {
      let draft = project.draft;
      for (const entry of parsed.entries) {
        draft = upsertWorldbookDraftEntry(draft, entry, { matchByKeys: parsed.match_by_keys }).entries;
      }
      return { ...project, draft };
    }, { expectedRevision: parsed.expected_revision });
    const validation = validateWorldbookDraft(result.draft ?? []);
    const comments = new Set(parsed.entries.map((entry) => entry.comment.trim()));
    const draftPaths = (result.draft ?? []).filter((entry) => comments.has(entry.comment)).map((entry) => ({ comment: entry.comment, path: draftEntryPath(entry.comment) }));
    return toolText({ project_id: parsed.project_id, revision: result.revision, saved_entry_count: parsed.entries.length, total_entry_count: result.draft?.length ?? 0, draft_paths: draftPaths, validation });
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
    const validation = validateWorldbookDraft(project.draft);
    if (!validation.valid) return toolText({ ok: false, validation });
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
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, worldbook_name: book.name, entry_count: draft.length, validation });
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
    return toolText({ ok: true, project_id: saved.id, revision: saved.revision, patch_id: patch.id, path: outputPath, backupPath, diff: applied.diff, entry_count: applied.entries.length });
  });

  server.tool("query_worldbook", { path: z.string().min(1), mode: z.enum(["brief", "uid", "search", "stats"]), uid: z.number().int().optional(), query: z.string().optional() }, async (input) => toolText(await queryWorldbook(input)));
}
