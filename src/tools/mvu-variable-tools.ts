import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../core/mvu-variable-editor.js";
import { updateMvuSource as updateMvuSourceSlice } from "../core/semantic-editors.js";
import { ListMvuVariablesInputSchema, RemoveMvuVariableInputSchema, RewriteMvuVariablesInputSchema, UpdateMvuSourceInputSchema, UpsertMvuVariableInputSchema } from "./mvu-variable-tool-schemas.js";
import { readDraftSlice, updateDraftSliceWithRevisionCheck } from "../storage/draft-store.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, versionSnapshot } from "../storage/version-manager.js";
import { MvuConfigSchema } from "../schemas/mvu.js";
import { toolText } from "./helpers.js";

export function registerMvuVariableTools(server: McpServer): void {
  server.tool("list_mvu_variables", ListMvuVariablesInputSchema.shape, async (input) => toolText(await logToolCall("list_mvu_variables", input, async () => {
    const parsed = ListMvuVariablesInputSchema.parse(input);
    const { slug } = await loadProjectWithSlug(parsed.project_id);
    const slice = await readDraftSlice(slug, "mvu", "mvu");
    const mvu = MvuConfigSchema.parse(slice.data);
    const listed = listMvuVariables(mvu);
    return { ok: true, project_id: parsed.project_id, slice: { id: slice.id, revision: slice.revision, active: slice.active }, variableListPath: mvu.variableListPath, variables: listed.variables, warnings: listed.warnings, ...(parsed.include_raw ? { raw: mvu } : {}) };
  })));

  server.tool("upsert_mvu_variable", UpsertMvuVariableInputSchema.shape, async (input) => toolText(await mutateMvu("upsert_mvu_variable", input, (mvu, parsed) => upsertMvuVariable(mvu, parsed, parsed.rewrite))));
  server.tool("remove_mvu_variable", RemoveMvuVariableInputSchema.shape, async (input) => toolText(await mutateMvu("remove_mvu_variable", input, (mvu, parsed) => removeMvuVariable(mvu, parsed.path, parsed.rewrite))));
  server.tool("rewrite_mvu_variables", RewriteMvuVariablesInputSchema.shape, async (input) => toolText(await mutateMvu("rewrite_mvu_variables", input, (mvu, parsed) => rewriteMvuVariables(mvu, parsed.variables, parsed.rewrite))));
  server.tool("update_mvu_source", UpdateMvuSourceInputSchema.shape, async (input) => toolText(await logToolCall("update_mvu_source", input, async () => {
    const parsed = UpdateMvuSourceInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const result = await updateDraftSliceWithRevisionCheck(slug, "mvu", "mvu", parsed.expected_slice_revision, (slice) => updateMvuSourceSlice(slice, parsed.changes as never));
    return { ok: true, project_id: parsed.project_id, slice: result.slice, version: versionSnapshot({ project, slice_revision: result.slice.revision }), affected: { artifact_targets: ["mvu", "regex", "ejs", "html"] }, next_tools: ["validate_project(scope='mvu')", "build_assets(target='all')"] };
  })));
}

async function mutateMvu(tool: string, input: unknown, editor: (mvu: import("../schemas/mvu.js").MvuConfig, parsed: any) => ReturnType<typeof upsertMvuVariable>) {
  return logToolCall(tool, input, async () => {
    const schema = tool === "upsert_mvu_variable" ? UpsertMvuVariableInputSchema : tool === "remove_mvu_variable" ? RemoveMvuVariableInputSchema : RewriteMvuVariablesInputSchema;
    const parsed = schema.parse(input) as any;
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    let edited: ReturnType<typeof upsertMvuVariable> | undefined;
    const result = await updateDraftSliceWithRevisionCheck(slug, "mvu", "mvu", parsed.expected_slice_revision, (slice) => {
      const mvu = MvuConfigSchema.parse(slice.data);
      edited = editor(mvu, parsed);
      return { ...slice, data: edited.mvu };
    });
    return { ok: true, project_id: parsed.project_id, slice: { id: result.slice.id, revision: result.slice.revision }, variables: edited?.variables, warnings: edited?.warnings, affected: { script_fields: ["schemaScript"], content_fields: ["initvar", "updateRules"], variable_paths: edited?.changed_path ? [edited.changed_path.join(".")] : [], artifact_targets: ["mvu", "regex", "ejs", "html"] }, version: versionSnapshot({ project, slice_revision: result.slice.revision }), next_tools: ["validate_project(scope='mvu')", "build_assets(target='all')"] };
  });
}
