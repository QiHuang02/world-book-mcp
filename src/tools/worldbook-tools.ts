import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createCharacterBasicEntryTemplate, createCharacterPersonalityEntryTemplate, validateCharacterAppearanceDistinctiveness, validateCharacterEntryStructure } from "../core/character-templates.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { createDraftTemplate } from "../core/draft-template.js";
import { updateDraftEntries } from "../core/draft-update.js";
import { validateItemEntry } from "../core/item-entry-validator.js";
import { applyPatchToDraft, createPatch, previewPatch } from "../core/worldbook-patch.js";
import { importWorldbookFromFile } from "../core/worldbook-importer.js";
import { buildWorldbookJson } from "../core/worldbook-builder.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { validateWorldbookDraft } from "../core/worldbook-validator.js";
import { createWorldbookEntryPlan, validateWorldbookEntryPlan } from "../core/worldbook-planning.js";
import { CreateWorldbookDraftTemplateInputSchema, DraftWorldbookEntriesInputSchema, EntryTypeSchema, GenerateWorldbookJsonInputSchema, UpdateWorldbookDraftEntriesInputSchema, ValidateWorldbookDraftInputSchema } from "../schemas/worldbook-draft.js";
import { ApplyWorldbookPatchInputSchema, CreateWorldbookPatchInputSchema, ImportWorldbookJsonInputSchema, PreviewWorldbookPatchInputSchema } from "../schemas/worldbook-patch.js";
import { resolveBackupPath, resolveExportPath, resolveReadableWorldbookPath } from "../storage/path-policy.js";
import { loadOrCreateProject, loadProject, saveProject } from "../storage/project-store.js";
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
      await saveProject({ ...project, plan: result.entries_plan });
    }
    return toolText({ project_id: input.project_id, saved: input.save, ...result, validation: validateWorldbookEntryPlan({ card_type: input.card_type, plan: result.entries_plan }), recommended_next_tool: "create_worldbook_draft_template" });
  });

  server.tool("validate_worldbook_entry_plan", { card_type: z.enum(["single_character_card", "multi_character_card", "worldbook_only"]), plan: z.array(z.object({ comment: z.string(), entryType: EntryTypeSchema, position: z.enum(["before_char", "after_char", "before_an", "after_an", "at_depth", "before_em", "after_em", "outlet"]), order: z.number(), constant: z.boolean(), keys: z.array(z.string()).default([]), reason: z.string() })) }, async (input) => toolText(validateWorldbookEntryPlan(input)));

  server.tool("create_worldbook_draft_template", CreateWorldbookDraftTemplateInputSchema.shape, async (input) => {
    const parsed = CreateWorldbookDraftTemplateInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.plan) throw new Error("项目尚未生成 entries plan");
    const template = createDraftTemplate(project.plan);
    if (parsed.save) {
      await saveProject({ ...project, draft: template });
    }
    return toolText({ project_id: parsed.project_id, saved: parsed.save, entries: template, recommended_next_tool: "draft_worldbook_entries" });
  });

  server.tool("draft_worldbook_entries", DraftWorldbookEntriesInputSchema.shape, async (input) => {
    const parsed = DraftWorldbookEntriesInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    await saveProject({ ...project, draft: parsed.entries });
    const validation = validateWorldbookDraft(parsed.entries);
    return toolText({ project_id: parsed.project_id, saved_entry_count: parsed.entries.length, validation, recommended_next_tool: validation.valid ? "generate_worldbook_json" : "validate_worldbook_draft" });
  });

  server.tool("update_worldbook_draft_entries", UpdateWorldbookDraftEntriesInputSchema.shape, async (input) => {
    const parsed = UpdateWorldbookDraftEntriesInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
    const draft = updateDraftEntries(project.draft, parsed.patches);
    await saveProject({ ...project, draft });
    const validation = parsed.validate ? validateWorldbookDraft(draft) : undefined;
    return toolText({ project_id: parsed.project_id, updated_entry_count: parsed.patches.length, validation, recommended_next_tool: validation?.valid ? "generate_worldbook_json" : "validate_worldbook_draft" });
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
    if (!parsed.overwrite) {
      try {
        await fs.access(outputPath);
        return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath });
      } catch {
        // 文件不存在，可以写入
      }
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, toPrettyJson(book), "utf8");
    return toolText({ ok: true, path: outputPath, worldbook_name: book.name, entry_count: Object.keys(book.entries).length });
  });

  server.tool("import_worldbook_json", ImportWorldbookJsonInputSchema.shape, async (input) => {
    const parsed = ImportWorldbookJsonInputSchema.parse(input);
    const sourcePath = resolveReadableWorldbookPath(parsed.path);
    const { book, draft } = await importWorldbookFromFile(sourcePath);
    const project = await loadOrCreateProject(undefined, parsed.project_name ?? book.name);
    const saved = await saveProject({ ...project, name: parsed.project_name ?? book.name, draft, importedWorldbookPath: sourcePath });
    const validation = validateWorldbookDraft(draft);
    return toolText({ project_id: saved.id, worldbook_name: book.name, entry_count: draft.length, validation, recommended_next_tool: "create_worldbook_patch" });
  });

  server.tool("create_worldbook_patch", CreateWorldbookPatchInputSchema.shape, async (input) => {
    const parsed = CreateWorldbookPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    if (!project.draft) throw new Error("项目尚未保存 worldbook draft");
    const patch = createPatch({ projectId: project.id, sourcePath: project.importedWorldbookPath, operations: parsed.operations });
    const preview = previewPatch(project, patch);
    await saveProject({ ...project, patches: [...(project.patches ?? []), patch] });
    return toolText({ project_id: project.id, patch_id: patch.id, operation_count: patch.operations.length, validation: preview.validation, recommended_next_tool: "preview_worldbook_patch" });
  });

  server.tool("preview_worldbook_patch", PreviewWorldbookPatchInputSchema.shape, async (input) => {
    const parsed = PreviewWorldbookPatchInputSchema.parse(input);
    const project = await loadProject(parsed.project_id);
    const patch = project.patches?.find((item) => item.id === parsed.patch_id);
    if (!patch) throw new Error(`未找到 patch_id=${parsed.patch_id}`);
    const preview = previewPatch(project, patch);
    return toolText({ project_id: project.id, patch_id: patch.id, diff: preview.diff, validation: preview.validation, recommended_next_tool: preview.validation.valid ? "apply_worldbook_patch" : "create_worldbook_patch" });
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
    if (parsed.backup) {
      try {
        await fs.access(outputPath);
        backupPath = resolveBackupPath(outputPath);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.copyFile(outputPath, backupPath);
      } catch {
        // 目标不存在时无需备份
      }
    }
    if (!parsed.overwrite) {
      try {
        await fs.access(outputPath);
        return toolText({ ok: false, error: "文件已存在，如需覆盖请设置 overwrite=true", path: outputPath, backupPath });
      } catch {
        // 文件不存在，可以写入
      }
    }
    const book = buildWorldbookJson({ name: project.name, entries: applied.entries });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, toPrettyJson(book), "utf8");
    await saveProject({ ...project, draft: applied.entries, importedWorldbookPath: outputPath });
    return toolText({ ok: true, project_id: project.id, patch_id: patch.id, path: outputPath, backupPath, diff: applied.diff, entry_count: applied.entries.length });
  });

  server.tool("query_worldbook", { path: z.string().min(1), mode: z.enum(["brief", "uid", "search", "stats"]), uid: z.number().int().optional(), query: z.string().optional() }, async (input) => toolText(await queryWorldbook(input)));
}
