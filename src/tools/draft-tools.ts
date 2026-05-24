import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHtmlBeautifyTemplate } from "../core/html-beautify-template.js";
import { createMvuTemplate } from "../core/mvu-template.js";
import { createWorldbookDraftTemplate } from "../core/worldbook-draft-editor.js";
import { updateDraftSliceField, updateDraftSliceFields } from "../core/draft-field-editor.js";
import { CreateDraftSliceInputSchema, DeleteDraftSliceInputSchema, DraftSliceDataSchemas, GetDraftSliceInputSchema, ListDraftSlicesInputSchema, UpdateDraftFieldInputSchema, UpdateDraftFieldsInputSchema, type DraftType } from "../schemas/draft-slice.js";
import { createDraftSlice, deleteDraftSlice, draftSlicePath, listDraftSlices, readDraftSlice, updateDraftSliceWithRevisionCheck, upsertDraftSlice } from "../storage/draft-store.js";
import { loadProject, updateProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

export function registerDraftTools(server: McpServer): void {
  server.tool("create_draft_slice", CreateDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("create_draft_slice", input, async () => {
    const parsed = CreateDraftSliceInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const exists = await readMaybe(parsed.draft_type, parsed.id);
    if (exists && parsed.if_exists === "error") throw new Error(`draft ${parsed.draft_type}/${parsed.id} 已存在`);
    if (exists && parsed.if_exists === "return_existing") return { ok: true, created: false, slice: exists, path: draftSlicePath(parsed.draft_type, parsed.id) };
    const data = defaultDataForSlice(parsed.draft_type, parsed.id, parsed.title);
    const { slice, path } = await upsertDraftSlice(createDraftSlice({ type: parsed.draft_type, id: parsed.id, title: parsed.title, data }));
    if (parsed.expected_revision !== undefined) await updateProject(parsed.project_id, (project) => project, { expectedRevision: parsed.expected_revision });
    return { ok: true, created: !exists, overwritten: Boolean(exists), slice, path, next_fields: Object.keys(DraftSliceDataSchemas[parsed.draft_type].safeParse(slice.data).success ? slice.data as Record<string, unknown> : {}) };
  })));

  server.tool("update_draft_field", UpdateDraftFieldInputSchema.shape, async (input) => toolText(await logToolCall("update_draft_field", input, async () => {
    const parsed = UpdateDraftFieldInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const result = await updateDraftSliceWithRevisionCheck(
      parsed.draft_type, parsed.id, parsed.expected_slice_revision,
      (slice) => updateDraftSliceField(slice, parsed.field_path, parsed.value),
    );
    return { ok: true, project_id: parsed.project_id, slice: result.slice, path: result.path };
  })));

  server.tool("update_draft_fields", UpdateDraftFieldsInputSchema.shape, async (input) => toolText(await logToolCall("update_draft_fields", input, async () => {
    const parsed = UpdateDraftFieldsInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const result = await updateDraftSliceWithRevisionCheck(
      parsed.draft_type, parsed.id, parsed.expected_slice_revision,
      (slice) => updateDraftSliceFields(slice, parsed.changes),
    );
    return { ok: true, project_id: parsed.project_id, slice: result.slice, path: result.path };
  })));

  server.tool("list_draft_slices", ListDraftSlicesInputSchema.shape, async (input) => toolText(await logToolCall("list_draft_slices", input, async () => {
    const parsed = ListDraftSlicesInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const slices = await listDraftSlices(parsed.draft_type);
    return { project_id: parsed.project_id, count: slices.length, slices: slices.map((slice) => ({
      id: slice.id,
      type: slice.type,
      title: slice.title,
      enabled: slice.enabled,
      revision: slice.revision,
      path: draftSlicePath(slice.type, slice.id),
      ...(parsed.include_content ? { data: slice.data } : { data_summary: summarizeData(slice.data) }),
    })) };
  })));

  server.tool("get_draft_slice", GetDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("get_draft_slice", input, async () => {
    const parsed = GetDraftSliceInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const slice = await readDraftSlice(parsed.draft_type, parsed.id);
    return { project_id: parsed.project_id, path: draftSlicePath(parsed.draft_type, parsed.id), slice };
  })));

  server.tool("delete_draft_slice", DeleteDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("delete_draft_slice", input, async () => {
    const parsed = DeleteDraftSliceInputSchema.parse(input);
    if (parsed.expected_slice_revision !== undefined) {
      const slice = await readDraftSlice(parsed.draft_type, parsed.id);
      assertSliceRevision(slice.revision, parsed.expected_slice_revision);
    }
    if (parsed.expected_revision !== undefined) await updateProject(parsed.project_id, (project) => project, { expectedRevision: parsed.expected_revision });
    const path = await deleteDraftSlice(parsed.draft_type, parsed.id);
    return { ok: true, project_id: parsed.project_id, deleted_path: path };
  })));
}

async function readMaybe(type: Parameters<typeof readDraftSlice>[0], id: string) {
  try { return await readDraftSlice(type, id); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

function defaultDataForSlice(type: DraftType, id: string, title?: string): unknown {
  switch (type) {
    case "worldbook_entry": return createWorldbookDraftTemplate({ comment: title ?? id });
    case "character_profile": return { name: title ?? id, include_worldbook: true };
    case "character_greetings": return { first_mes: "", alternate_greetings: [] };
    case "mvu_schema": return createMvuTemplate({ characterNames: [title ?? "角色"] }).mvu;
    case "mvu_update_rules": return createMvuTemplate({ characterNames: [title ?? "角色"] }).mvu;
    case "html_statusbar": {
      const html = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" }).html;
      return { enabled: html.enabled, target: html.target, theme: html.theme, html: html.statusbar.html, hide_regex: html.statusbar.hide_regex };
    }
    case "html_regex": return { name: title ?? id, findRegex: "<StatusPlaceHolderImpl\\/>", replaceString: "", markdownOnly: true, promptOnly: false, placement: [2], runOnEdit: false };
    case "ejs_entry": return { name: title ?? id, role: "inline", content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: true };
    case "style_profile": return {};
    case "chapter_outline": return {};
  }
}

function assertSliceRevision(actual: number, expected?: number): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`draft slice revision 冲突：expected=${expected}, actual=${actual}`);
  }
}

function summarizeData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    result[key] = typeof value === "string" ? { chars: value.length, preview: value.slice(0, 80) } : value;
  }
  return result;
}
