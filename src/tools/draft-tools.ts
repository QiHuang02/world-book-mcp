import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHtmlTemplate, createMvuTemplate, createRegexTemplate, createEjsTemplate, createEntryTemplate } from "../core/templates-v3.js";
import { createMvuSystemEntries, MVU_ENTRY_IDS, MVU_ENTRY_KEYS } from "../core/mvu-entry-templates.js";
import { recomputeProjectKindFromSlices } from "../core/project-kind.js";
import { updateEntryConfig, updateEntryContent, updateEjsConfig, updateEjsContent, updateHtmlConfig, updateHtmlStatusbar, updateSliceMetadata } from "../core/semantic-editors.js";
import type { DraftType } from "../schemas/draft-slice.js";
import { MvuConfigSchema } from "../schemas/mvu.js";
import { CreateDraftSliceInputSchema, DeleteDraftSliceInputSchema, GetDraftSliceInputSchema, ListDraftSlicesInputSchema, UpdateEjsConfigInputSchema, UpdateEjsContentInputSchema, UpdateEntryConfigInputSchema, UpdateEntryContentInputSchema, UpdateHtmlConfigInputSchema, UpdateHtmlStatusbarInputSchema, UpdateSliceMetadataInputSchema } from "./draft-tool-schemas.js";
import { createDraftSlice, deleteDraftSlice, draftSlicePath, listDraftSlices, readDraftSlice, updateDraftSliceWithRevisionCheck, upsertDraftSlice, canonicalSliceId } from "../storage/draft-store.js";
import { loadProjectWithSlug, updateProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";

export function registerDraftTools(server: McpServer): void {
  server.tool("create_draft_slice", CreateDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("create_draft_slice", input, async () => {
    const parsed = CreateDraftSliceInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    if (parsed.source === "imported" && parsed.origin?.kind !== "imported") throw new Error("source=imported 时必须提供 imported origin");
    if (parsed.draft_type === "ejs" && parsed.active && !project.kind.assets.mvu.enabled && !project.kind.assets.mvu.planned) throw new Error("active EJS slice 依赖 MVU，请先创建/规划 mvu slice，或传 active=false");
    try { await readDraftSlice(slug, parsed.draft_type, id); if (parsed.if_exists === "error") throw new Error(`draft ${parsed.draft_type}/${id} 已存在`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const data = parsed.data ?? defaultDataForSlice(parsed.draft_type, id, parsed.title, parsed.preset);
    const written = await upsertDraftSlice(slug, createDraftSlice({ type: parsed.draft_type, id, title: parsed.title, active: parsed.active, source: parsed.source, origin: parsed.origin, tags: parsed.tags, notes: parsed.notes, data }));
    if (parsed.draft_type === "mvu") await ensureMvuSystemEntrySlices(slug, MvuConfigSchema.parse(written.slice.data));
    const slices = await listDraftSlices(slug);
    const saved = await updateProject(project.id, (latest) => ({ ...latest, kind: recomputeProjectKindFromSlices(latest, slices) }));
    return { ok: true, created: true, slice: written.slice, path: written.path, version: versionSnapshot({ project: saved, slice_revision: written.slice.revision }), next_tools: ["validate_project(scope='all')"] };
  })));

  server.tool("update_slice_metadata", UpdateSliceMetadataInputSchema.shape, async (input) => toolText(await logToolCall("update_slice_metadata", input, async () => {
    const parsed = UpdateSliceMetadataInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const id = canonicalSliceId(parsed.draft_type, parsed.id);
    const result = await updateDraftSliceWithRevisionCheck(slug, parsed.draft_type, id, parsed.expected_slice_revision, (slice) => updateSliceMetadata(slice, parsed.changes));
    const slices = await listDraftSlices(slug);
    const saved = await updateProject(project.id, (latest) => ({ ...latest, kind: recomputeProjectKindFromSlices(latest, slices) }));
    return { ok: true, slice: result.slice, path: result.path, version: versionSnapshot({ project: saved, slice_revision: result.slice.revision }) };
  })));

  server.tool("update_entry_content", UpdateEntryContentInputSchema.shape, async (input) => toolText(await updateSliceTool("update_entry_content", input, "entry", (slice) => updateEntryContent(slice, UpdateEntryContentInputSchema.parse(input).content), ["validate_project(scope='worldbook')", "build_assets(target='all')"])));
  server.tool("update_entry_config", UpdateEntryConfigInputSchema.shape, async (input) => toolText(await updateSliceTool("update_entry_config", input, "entry", (slice) => updateEntryConfig(slice, UpdateEntryConfigInputSchema.parse(input).changes as never), ["validate_project(scope='worldbook')"])));
  server.tool("update_html_statusbar", UpdateHtmlStatusbarInputSchema.shape, async (input) => toolText(await updateSliceTool("update_html_statusbar", input, "html", (slice) => updateHtmlStatusbar(slice, UpdateHtmlStatusbarInputSchema.parse(input)), ["validate_project(scope='html')", "build_assets(target='html')"])));
  server.tool("update_html_config", UpdateHtmlConfigInputSchema.shape, async (input) => toolText(await updateSliceTool("update_html_config", input, "html", (slice) => updateHtmlConfig(slice, UpdateHtmlConfigInputSchema.parse(input).changes), ["validate_project(scope='html')", "build_assets(target='regex')"])));
  server.tool("update_ejs_content", UpdateEjsContentInputSchema.shape, async (input) => { const parsed = UpdateEjsContentInputSchema.parse(input); return toolText(await updateSliceTool("update_ejs_content", input, "ejs", (slice) => updateEjsContent(slice, { content: parsed.content, variablePaths: parsed.variablePaths }), ["validate_project(scope='ejs')", "build_assets(target='ejs')"])); });
  server.tool("update_ejs_config", UpdateEjsConfigInputSchema.shape, async (input) => { const parsed = UpdateEjsConfigInputSchema.parse(input); return toolText(await updateSliceTool("update_ejs_config", input, "ejs", (slice) => updateEjsConfig(slice, parsed.changes as never), ["validate_project(scope='ejs')"])); });

  server.tool("list_draft_slices", ListDraftSlicesInputSchema.shape, async (input) => toolText(await logToolCall("list_draft_slices", input, async () => {
    const parsed = ListDraftSlicesInputSchema.parse(input);
    const { slug } = await loadProjectWithSlug(parsed.project_id);
    const slices = await listDraftSlices(slug, parsed.draft_type);
    return { project_id: parsed.project_id, count: slices.length, slices: slices.map((slice) => ({ id: slice.id, type: slice.type, title: slice.title, active: slice.active, source: slice.source, revision: slice.revision, path: draftSlicePath(slug, slice.type, slice.id), ...(parsed.include_content ? { data: slice.data } : { data_summary: summarizeData(slice.data) }) })) };
  })));
  server.tool("get_draft_slice", GetDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("get_draft_slice", input, async () => { const parsed = GetDraftSliceInputSchema.parse(input); const { slug } = await loadProjectWithSlug(parsed.project_id); const id = canonicalSliceId(parsed.draft_type, parsed.id); return { project_id: parsed.project_id, path: draftSlicePath(slug, parsed.draft_type, id), slice: await readDraftSlice(slug, parsed.draft_type, id) }; })));
  server.tool("delete_draft_slice", DeleteDraftSliceInputSchema.shape, async (input) => toolText(await logToolCall("delete_draft_slice", input, async () => { const parsed = DeleteDraftSliceInputSchema.parse(input); const { project, slug } = await loadProjectWithSlug(parsed.project_id); assertProjectRevisionValue(project, parsed.expected_project_revision); const id = canonicalSliceId(parsed.draft_type, parsed.id); if (parsed.expected_slice_revision !== undefined) { const slice = await readDraftSlice(slug, parsed.draft_type, id); if (slice.revision !== parsed.expected_slice_revision) throw new Error(`draft slice revision 冲突：expected=${parsed.expected_slice_revision}, actual=${slice.revision}`); } const deletedPath = await deleteDraftSlice(slug, parsed.draft_type, id); const slices = await listDraftSlices(slug); await updateProject(project.id, (latest) => ({ ...latest, kind: recomputeProjectKindFromSlices(latest, slices) })); return { ok: true, project_id: parsed.project_id, deleted_path: deletedPath }; })));
}

async function updateSliceTool(tool: string, input: unknown, type: DraftType, mutator: Parameters<typeof updateDraftSliceWithRevisionCheck>[4], next_tools: string[]) {
  return logToolCall(tool, input, async () => {
    const parsed = (input as { project_id: string; id?: string; expected_project_revision?: number; expected_slice_revision?: number });
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const id = canonicalSliceId(type, parsed.id ?? type);
    const result = await updateDraftSliceWithRevisionCheck(slug, type, id, parsed.expected_slice_revision, mutator);
    return { ok: true, project_id: parsed.project_id, slice: result.slice, path: result.path, affected: { artifact_targets: [type === "entry" ? "worldbook" : type] }, version: versionSnapshot({ project, slice_revision: result.slice.revision }), next_tools };
  });
}

async function ensureMvuSystemEntrySlices(slug: string, runtime: import("../schemas/mvu.js").MvuConfig): Promise<void> {
  const entries = createMvuSystemEntries({ runtime });
  const keys = runtime.variableListPath === null ? MVU_ENTRY_KEYS.filter((key) => key !== "variableList") : MVU_ENTRY_KEYS;
  for (const [index, entry] of entries.entries()) {
    const id = MVU_ENTRY_IDS[keys[index]];
    try { await readDraftSlice(slug, "entry", id); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await upsertDraftSlice(slug, createDraftSlice({ type: "entry", id, title: entry.comment, source: "generated", data: entry }));
    }
  }
}

function defaultDataForSlice(type: DraftType, id: string, title?: string, preset?: string): unknown {
  switch (type) {
    case "entry": return createEntryTemplate({ comment: title ?? id });
    case "mvu": return createMvuTemplate();
    case "html": return createHtmlTemplate();
    case "regex": return createRegexTemplate();
    case "ejs": return createEjsTemplate({ id, title, preset });
  }
}
function summarizeData(data: unknown): unknown { if (!data || typeof data !== "object") return data; const result: Record<string, unknown> = {}; for (const [key, value] of Object.entries(data as Record<string, unknown>)) result[key] = typeof value === "string" ? { chars: value.length, preview: value.slice(0, 80) } : value; return result; }
