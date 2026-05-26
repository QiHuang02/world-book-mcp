import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHtmlBeautifyTemplate } from "../core/html-beautify-template.js";
import { createMvuTemplate } from "../core/mvu-template.js";
import { createWorldbookDraftTemplate } from "../core/worldbook-draft-editor.js";
import { updateDraftSliceField, updateDraftSliceFields } from "../core/draft-field-editor.js";
import { CreateDraftSliceInputSchema, DeleteDraftSliceInputSchema, DraftSliceDataSchemas, GetDraftSliceInputSchema, ListDraftSlicesInputSchema, UpdateDraftFieldInputSchema, UpdateDraftFieldsInputSchema, type DraftType } from "../schemas/draft-slice.js";
import { createDraftSlice, deleteDraftSlice, draftSlicePath, listDraftSlices, readDraftSlice, updateDraftSliceWithRevisionCheck, upsertDraftSlice } from "../storage/draft-store.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, assertWorkspaceRevision, resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";

export function registerDraftTools(server: McpServer): void {
  server.tool("create_draft_slice", CreateDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("create_draft_slice", input, async () => {
    const parsed = CreateDraftSliceInputSchema.parse(input);
    const workspace = await assertWorkspaceRevision(parsed.expected_workspace_revision);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    const exists = await readMaybe(slug, parsed.draft_type, id);
    if (exists && parsed.if_exists === "error") throw new Error(`draft ${parsed.draft_type}/${id} 已存在`);
    if (exists && parsed.expected_slice_revision !== undefined && exists.revision !== parsed.expected_slice_revision) throw new Error(`draft slice revision 冲突：expected=${parsed.expected_slice_revision}, actual=${exists.revision}`);
    if (exists && parsed.if_exists === "return_existing") return { ok: true, created: false, slice: exists, path: draftSlicePath(slug, parsed.draft_type, id), version: versionSnapshot({ workspace, project, slice_revision: exists.revision }) };
    const data = defaultDataForSlice(parsed.draft_type, id, parsed.title, parsed.preset);
    const { slice, path } = await upsertDraftSlice(slug, createDraftSlice({ type: parsed.draft_type, id, title: parsed.title, data }));
    return { ok: true, created: !exists, overwritten: Boolean(exists), slice, path, version: versionSnapshot({ workspace, project, slice_revision: slice.revision }), next_fields: Object.keys(DraftSliceDataSchemas[parsed.draft_type].safeParse(slice.data).success ? slice.data as Record<string, unknown> : {}) };
  })));

  server.tool("update_draft_field", UpdateDraftFieldInputSchema.shape, async (input) => toolText(await logToolCall("update_draft_field", input, async () => {
    const parsed = UpdateDraftFieldInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    const result = await updateDraftSliceWithRevisionCheck(slug, parsed.draft_type, id, parsed.expected_slice_revision, (slice) => updateDraftSliceField(slice, parsed.field_path, parsed.value));
    return { ok: true, project_id: parsed.project_id, slice: result.slice, path: result.path, version: versionSnapshot({ project, slice_revision: result.slice.revision }) };
  })));

  server.tool("update_draft_fields", UpdateDraftFieldsInputSchema.shape, async (input) => toolText(await logToolCall("update_draft_fields", input, async () => {
    const parsed = UpdateDraftFieldsInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    const result = await updateDraftSliceWithRevisionCheck(slug, parsed.draft_type, id, parsed.expected_slice_revision, (slice) => updateDraftSliceFields(slice, parsed.changes));
    return { ok: true, project_id: parsed.project_id, slice: result.slice, path: result.path, version: versionSnapshot({ project, slice_revision: result.slice.revision }) };
  })));

  server.tool("list_draft_slices", ListDraftSlicesInputSchema.shape, async (input) => toolText(await logToolCall("list_draft_slices", input, async () => {
    const parsed = ListDraftSlicesInputSchema.parse(input);
    const { slug } = await loadProjectWithSlug(parsed.project_id);
    const slices = await listDraftSlices(slug, parsed.draft_type);
    return { project_id: parsed.project_id, count: slices.length, slices: slices.map((slice) => ({
      id: slice.id,
      type: slice.type,
      title: slice.title,
      enabled: slice.enabled,
      revision: slice.revision,
      path: draftSlicePath(slug, slice.type, slice.id),
      ...(parsed.include_content ? { data: slice.data } : { data_summary: summarizeData(slice.data) }),
    })) };
  })));

  server.tool("get_draft_slice", GetDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("get_draft_slice", input, async () => {
    const parsed = GetDraftSliceInputSchema.parse(input);
    const { slug } = await loadProjectWithSlug(parsed.project_id);
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    const slice = await readDraftSlice(slug, parsed.draft_type, id);
    return { project_id: parsed.project_id, path: draftSlicePath(slug, parsed.draft_type, id), slice };
  })));

  server.tool("delete_draft_slice", DeleteDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("delete_draft_slice", input, async () => {
    const parsed = DeleteDraftSliceInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    if (parsed.expected_slice_revision !== undefined) {
      const slice = await readDraftSlice(slug, parsed.draft_type, id);
      assertSliceRevision(slice.revision, parsed.expected_slice_revision);
    }
    const deletedPath = await deleteDraftSlice(slug, parsed.draft_type, id);
    return { ok: true, project_id: parsed.project_id, deleted_path: deletedPath };
  })));
}

async function readMaybe(slug: string, type: Parameters<typeof readDraftSlice>[1], id: string) {
  try { return await readDraftSlice(slug, type, id); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

function canonicalSliceId(type: DraftType, id: string): string {
  return type === "mvu" || type === "html" ? type : id;
}

function defaultDataForSlice(type: DraftType, id: string, title?: string, preset?: string): unknown {
  switch (type) {
    case "entry": return createWorldbookDraftTemplate({ comment: title ?? id });
    case "mvu": return createMvuTemplate({ characterNames: [title ?? "角色"] }).mvu;
    case "html": return createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" }).html;
    case "ejs": {
      const role = preset === "stage" ? "stage" : "inline";
      return { name: title ?? id, role, content: "", keys: [], constant: true, position: "after_char", order: 100, enabled: role === "stage" ? false : true };
    }
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
