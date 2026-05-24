import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listMvuVariables, removeMvuVariable, rewriteMvuVariables, upsertMvuVariable } from "../core/mvu-variable-editor.js";
import { ListMvuVariablesInputSchema, MvuConfigSchema, RemoveMvuVariableInputSchema, RewriteMvuVariablesInputSchema, UpsertMvuVariableInputSchema } from "../schemas/mvu.js";
import { readDraftSlice, upsertDraftSlice } from "../storage/draft-store.js";
import { loadProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";

export function registerMvuVariableTools(server: McpServer): void {
  // 注意：MVU variable tools 同时操作 schema + rules 两个 slice，revision check 在队列外完成。
  // MCP 协议本身是串行的，所以并发风险有限；如果未来引入并行调用，需要改为组合锁。
  server.tool("list_mvu_variables", ListMvuVariablesInputSchema.shape, async (input) => toolText(await logToolCall("list_mvu_variables", input, async () => {
    const parsed = ListMvuVariablesInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const schemaSlice = await readDraftSlice("mvu_schema", parsed.schema_slice_id);
    const mvu = MvuConfigSchema.parse(schemaSlice.data);
    const result = listMvuVariables(mvu);
    return { ok: true, project_id: parsed.project_id, schema_slice_id: parsed.schema_slice_id, slice_revision: schemaSlice.revision, ...result };
  })));

  server.tool("upsert_mvu_variable", UpsertMvuVariableInputSchema.shape, async (input) => toolText(await logToolCall("upsert_mvu_variable", input, async () => {
    const parsed = UpsertMvuVariableInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const schemaSlice = await readDraftSlice("mvu_schema", parsed.schema_slice_id);
    assertSliceRevision(schemaSlice.revision, parsed.expected_schema_slice_revision);
    const rulesSlice = parsed.rules_slice_id ? await readDraftSlice("mvu_update_rules", parsed.rules_slice_id) : undefined;
    if (rulesSlice) assertSliceRevision(rulesSlice.revision, parsed.expected_rules_slice_revision);
    const mvu = MvuConfigSchema.parse({ ...(rulesSlice?.data as object | undefined), ...(schemaSlice.data as object) });
    const result = upsertMvuVariable(mvu, parsed, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
    const schemaWrite = await upsertDraftSlice({ ...schemaSlice, data: schemaData(result.mvu) });
    const rulesWrite = rulesSlice ? await upsertDraftSlice({ ...rulesSlice, data: rulesData(result.mvu) }) : undefined;
    return {
      ok: true,
      project_id: parsed.project_id,
      changed_path: result.changed_path,
      created: result.created,
      warnings: result.warnings,
      schema_slice: { id: schemaWrite.slice.id, revision: schemaWrite.slice.revision, path: schemaWrite.path },
      rules_slice: rulesWrite ? { id: rulesWrite.slice.id, revision: rulesWrite.slice.revision, path: rulesWrite.path } : undefined,
      variable_count: result.variables.length,
      next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"],
    };
  })));

  server.tool("remove_mvu_variable", RemoveMvuVariableInputSchema.shape, async (input) => toolText(await logToolCall("remove_mvu_variable", input, async () => {
    const parsed = RemoveMvuVariableInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const schemaSlice = await readDraftSlice("mvu_schema", parsed.schema_slice_id);
    assertSliceRevision(schemaSlice.revision, parsed.expected_schema_slice_revision);
    const rulesSlice = parsed.rules_slice_id ? await readDraftSlice("mvu_update_rules", parsed.rules_slice_id) : undefined;
    if (rulesSlice) assertSliceRevision(rulesSlice.revision, parsed.expected_rules_slice_revision);
    const mvu = MvuConfigSchema.parse({ ...(rulesSlice?.data as object | undefined), ...(schemaSlice.data as object) });
    const result = removeMvuVariable(mvu, parsed.path, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
    const schemaWrite = await upsertDraftSlice({ ...schemaSlice, data: schemaData(result.mvu) });
    const rulesWrite = rulesSlice ? await upsertDraftSlice({ ...rulesSlice, data: rulesData(result.mvu) }) : undefined;
    return {
      ok: true,
      project_id: parsed.project_id,
      changed_path: result.changed_path,
      removed: result.removed,
      warnings: result.warnings,
      schema_slice: { id: schemaWrite.slice.id, revision: schemaWrite.slice.revision, path: schemaWrite.path },
      rules_slice: rulesWrite ? { id: rulesWrite.slice.id, revision: rulesWrite.slice.revision, path: rulesWrite.path } : undefined,
      variable_count: result.variables.length,
      next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"],
    };
  })));

  server.tool("rewrite_mvu_variables", RewriteMvuVariablesInputSchema.shape, async (input) => toolText(await logToolCall("rewrite_mvu_variables", input, async () => {
    const parsed = RewriteMvuVariablesInputSchema.parse(input);
    await loadProject(parsed.project_id);
    const schemaSlice = await readDraftSlice("mvu_schema", parsed.schema_slice_id);
    assertSliceRevision(schemaSlice.revision, parsed.expected_schema_slice_revision);
    const rulesSlice = parsed.rules_slice_id ? await readDraftSlice("mvu_update_rules", parsed.rules_slice_id) : undefined;
    if (rulesSlice) assertSliceRevision(rulesSlice.revision, parsed.expected_rules_slice_revision);
    const mvu = MvuConfigSchema.parse({ ...(rulesSlice?.data as object | undefined), ...(schemaSlice.data as object) });
    const result = rewriteMvuVariables(mvu, parsed.variables, { rewriteInitvar: parsed.rewrite_initvar, rewriteUpdateRules: parsed.rewrite_update_rules });
    const schemaWrite = await upsertDraftSlice({ ...schemaSlice, data: schemaData(result.mvu) });
    const rulesWrite = rulesSlice ? await upsertDraftSlice({ ...rulesSlice, data: rulesData(result.mvu) }) : undefined;
    return {
      ok: true,
      project_id: parsed.project_id,
      warnings: result.warnings,
      schema_slice: { id: schemaWrite.slice.id, revision: schemaWrite.slice.revision, path: schemaWrite.path },
      rules_slice: rulesWrite ? { id: rulesWrite.slice.id, revision: rulesWrite.slice.revision, path: rulesWrite.path } : undefined,
      variable_count: result.variables.length,
      next_tools: ["validate_draft(scope='mvu')", "build_assets(target='mvu')"],
    };
  })));
}

function schemaData(mvu: ReturnType<typeof MvuConfigSchema.parse>) {
  return {
    enabled: mvu.enabled,
    style: mvu.style,
    schema_script: mvu.schema_script,
    output_format: mvu.output_format,
    variable_list_path: mvu.variable_list_path,
  };
}

function rulesData(mvu: ReturnType<typeof MvuConfigSchema.parse>) {
  return {
    enabled: mvu.enabled,
    initvar: mvu.initvar,
    update_rules: mvu.update_rules,
    hide_regex: mvu.hide_regex,
    beautify_regex: mvu.beautify_regex,
  };
}

function assertSliceRevision(actual: number, expected?: number): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`draft slice revision 冲突：expected=${expected}, actual=${actual}`);
  }
}
