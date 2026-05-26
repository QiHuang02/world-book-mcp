import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../core/mvu-variable-editor.js";
import { ListMvuVariablesInputSchema, MvuConfigSchema, RemoveMvuVariableInputSchema, RewriteMvuVariablesInputSchema, UpsertMvuVariableInputSchema } from "../schemas/mvu.js";
import { readDraftSlice, updateDraftSliceWithRevisionCheck } from "../storage/draft-store.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";

export function registerMvuVariableTools(server: McpServer): void {
  server.tool("list_mvu_variables", ListMvuVariablesInputSchema.shape, async (input) => toolText(await logToolCall("list_mvu_variables", input, async () => {
    const parsed = ListMvuVariablesInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    const slice = await readDraftSlice(slug, "mvu", "mvu");
    const mvu = MvuConfigSchema.parse(slice.data);
    const result = listMvuVariables(mvu);
    return { ok: true, project_id: parsed.project_id, slice_id: "mvu", slice_revision: slice.revision, version: versionSnapshot({ project, slice_revision: slice.revision }), ...result };
  })));

  server.tool("upsert_mvu_variable", UpsertMvuVariableInputSchema.shape, async (input) => toolText(await logToolCall("upsert_mvu_variable", input, async () => {
    const parsed = UpsertMvuVariableInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const write = await updateDraftSliceWithRevisionCheck(slug, "mvu", "mvu", parsed.expected_slice_revision, (slice) => {
      const mvu = MvuConfigSchema.parse(slice.data);
      const result = upsertMvuVariable(mvu, parsed, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
      return { ...slice, data: result.mvu };
    });
    const result = listMvuVariables(MvuConfigSchema.parse(write.slice.data));
    return { ok: true, project_id: parsed.project_id, changed_path: parsed.path.join("."), slice: { id: write.slice.id, revision: write.slice.revision, path: write.path }, version: versionSnapshot({ project, slice_revision: write.slice.revision }), variable_count: result.variables.length, next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"] };
  })));

  server.tool("remove_mvu_variable", RemoveMvuVariableInputSchema.shape, async (input) => toolText(await logToolCall("remove_mvu_variable", input, async () => {
    const parsed = RemoveMvuVariableInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    let removed = false;
    const write = await updateDraftSliceWithRevisionCheck(slug, "mvu", "mvu", parsed.expected_slice_revision, (slice) => {
      const mvu = MvuConfigSchema.parse(slice.data);
      const result = removeMvuVariable(mvu, parsed.path, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
      removed = Boolean(result.removed);
      return { ...slice, data: result.mvu };
    });
    const result = listMvuVariables(MvuConfigSchema.parse(write.slice.data));
    return { ok: true, project_id: parsed.project_id, removed, changed_path: parsed.path.join("."), slice: { id: write.slice.id, revision: write.slice.revision, path: write.path }, version: versionSnapshot({ project, slice_revision: write.slice.revision }), variable_count: result.variables.length, next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"] };
  })));

  server.tool("rewrite_mvu_variables", RewriteMvuVariablesInputSchema.shape, async (input) => toolText(await logToolCall("rewrite_mvu_variables", input, async () => {
    const parsed = RewriteMvuVariablesInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const write = await updateDraftSliceWithRevisionCheck(slug, "mvu", "mvu", parsed.expected_slice_revision, (slice) => {
      const mvu = MvuConfigSchema.parse(slice.data);
      const result = rewriteMvuVariables(mvu, parsed.variables, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
      return { ...slice, data: result.mvu };
    });
    const result = listMvuVariables(MvuConfigSchema.parse(write.slice.data));
    return { ok: true, project_id: parsed.project_id, slice: { id: write.slice.id, revision: write.slice.revision, path: write.path }, version: versionSnapshot({ project, slice_revision: write.slice.revision }), variable_count: result.variables.length, next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"] };
  })));
}
