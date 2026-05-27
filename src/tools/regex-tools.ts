import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { moveRegexScript, removeRegexScript, reorderRegexScripts, updateRegexScript, upsertRegexScript } from "../core/semantic-editors.js";
import { ListRegexScriptsInputSchema, MoveRegexScriptInputSchema, RemoveRegexScriptInputSchema, ReorderRegexScriptsInputSchema, UpdateRegexScriptInputSchema, UpsertRegexScriptInputSchema } from "./regex-tool-schemas.js";
import { canonicalSliceId, listDraftSlices, readDraftSlice, updateDraftSliceWithRevisionCheck } from "../storage/draft-store.js";
import { loadProjectWithSlug, updateProject } from "../storage/project-store.js";
import { recomputeProjectKindFromSlices } from "../core/project-kind.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";

export function registerRegexTools(server: McpServer): void {
  server.tool("list_regex_scripts", ListRegexScriptsInputSchema.shape, async (input) => toolText(await logToolCall("list_regex_scripts", input, async () => {
    const parsed = ListRegexScriptsInputSchema.parse(input);
    const { slug } = await loadProjectWithSlug(parsed.project_id);
    const slices = parsed.slice_id ? [await readDraftSlice(slug, "regex", parsed.slice_id)] : await listDraftSlices(slug, "regex");
    return { ok: true, slices: slices.filter((slice) => parsed.include_inactive_slices || slice.active).map((slice) => ({ slice_id: slice.id, active: slice.active, purpose: (slice.data as { purpose?: string }).purpose, scripts: ((slice.data as { scripts?: Array<{ disabled?: boolean }> }).scripts ?? []).filter((script) => parsed.include_disabled || !script.disabled) })) };
  })));
  server.tool("upsert_regex_script", UpsertRegexScriptInputSchema.shape, async (input) => toolText(await mutateRegex("upsert_regex_script", input, (slice, parsed) => upsertRegexScript(slice, parsed.script, parsed.if_exists))));
  server.tool("update_regex_script", UpdateRegexScriptInputSchema.shape, async (input) => toolText(await mutateRegex("update_regex_script", input, (slice, parsed) => updateRegexScript(slice, parsed.script_id, parsed.changes))));
  server.tool("remove_regex_script", RemoveRegexScriptInputSchema.shape, async (input) => toolText(await mutateRegex("remove_regex_script", input, (slice, parsed) => removeRegexScript(slice, parsed.script_id, parsed.deactivate_empty_slice))));
  server.tool("reorder_regex_scripts", ReorderRegexScriptsInputSchema.shape, async (input) => toolText(await mutateRegex("reorder_regex_scripts", input, (slice, parsed) => reorderRegexScripts(slice, parsed.script_order))));
  server.tool("move_regex_script", MoveRegexScriptInputSchema.shape, async (input) => toolText(await logToolCall("move_regex_script", input, async () => {
    const parsed = MoveRegexScriptInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const from = await readDraftSlice(slug, "regex", parsed.from_slice_id);
    const to = await readDraftSlice(slug, "regex", parsed.to_slice_id);
    if (parsed.expected_from_slice_revision !== undefined && from.revision !== parsed.expected_from_slice_revision) throw new Error("from slice revision conflict");
    if (parsed.expected_to_slice_revision !== undefined && to.revision !== parsed.expected_to_slice_revision) throw new Error("to slice revision conflict");
    const moved = moveRegexScript(from, to, parsed.script_id, { newScriptId: parsed.new_script_id, newOrder: parsed.new_order });
    const writeFrom = await updateDraftSliceWithRevisionCheck(slug, "regex", parsed.from_slice_id, parsed.expected_from_slice_revision, () => moved.from);
    const writeTo = await updateDraftSliceWithRevisionCheck(slug, "regex", parsed.to_slice_id, parsed.expected_to_slice_revision, () => moved.to);
    return { ok: true, from: writeFrom.slice, to: writeTo.slice, next_tools: ["validate_project(scope='regex')", "build_assets(target='regex')"] };
  })));
}

async function mutateRegex(tool: string, input: unknown, mutator: (slice: import("../schemas/draft-slice.js").DraftSlice, parsed: any) => import("../schemas/draft-slice.js").DraftSlice) {
  return logToolCall(tool, input, async () => {
    const parsed = (tool === "upsert_regex_script" ? UpsertRegexScriptInputSchema : tool === "update_regex_script" ? UpdateRegexScriptInputSchema : tool === "remove_regex_script" ? RemoveRegexScriptInputSchema : ReorderRegexScriptsInputSchema).parse(input) as any;
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const id = canonicalSliceId("regex", parsed.slice_id);
    const result = await updateDraftSliceWithRevisionCheck(slug, "regex", id, parsed.expected_slice_revision, (slice) => mutator(slice, parsed));
    const slices = await listDraftSlices(slug);
    const saved = await updateProject(project.id, (latest) => ({ ...latest, kind: recomputeProjectKindFromSlices(latest, slices) }));
    return { ok: true, project_id: parsed.project_id, slice: result.slice, version: versionSnapshot({ project: saved, slice_revision: result.slice.revision }), next_tools: ["validate_project(scope='regex')", "build_assets(target='regex')"] };
  });
}
