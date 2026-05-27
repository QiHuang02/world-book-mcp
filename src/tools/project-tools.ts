import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importExistingJson, scanImportCandidates } from "../core/import-existing-json.js";
import { recomputeProjectKindFromSlices } from "../core/project-kind.js";
import { listDraftSlices } from "../storage/draft-store.js";
import { listProjects, loadProject, loadProjectWithSlug, summarizeProject, updateProject } from "../storage/project-store.js";
import { ensureRootTemplateJson, initWorkspaceProject } from "../storage/workspace-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toolText } from "./helpers.js";
import { GetProjectInputSchema, ImportExistingJsonInputSchema, InitProjectInputSchema } from "./project-tool-schemas.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("init_project", InitProjectInputSchema.shape, async (input) => toolText(await logToolCall("init_project", input, async () => {
    const parsed = InitProjectInputSchema.parse(input);
    const scanExisting = parsed.source === "modify_existing" ? true : parsed.scan_existing ?? false;
    const importStrategy = parsed.source === "modify_existing" ? parsed.import_strategy ?? "auto" : parsed.import_strategy ?? "none";
    const { project, created, workspace, slug } = await initWorkspaceProject({ name: parsed.name, output: parsed.output, source: parsed.source, assets: parsed.assets, opening: parsed.opening, projectId: parsed.project_id, ifExists: parsed.if_exists });
    const rootTemplate = parsed.source === "modify_existing" ? undefined : await ensureRootTemplateJson({ name: parsed.name, output: parsed.output });
    let importResult: Awaited<ReturnType<typeof importExistingJson>> | undefined;
    if (scanExisting) {
      if (importStrategy === "ask") {
        const candidates = await scanImportCandidates();
        return { ok: candidates.length <= 1, project_id: project.id, slug, created, workspace, import_candidates: candidates, next_actions: ["选择候选 JSON 后调用 import_existing_json(path=...)"] };
      }
      importResult = await importExistingJson(project, slug, { set_as_import_target: true });
      if (importResult.candidates) return { ok: false, project_id: project.id, slug, created, workspace, import_candidates: importResult.candidates, warnings: importResult.warnings, next_actions: ["选择候选 JSON 后调用 import_existing_json(path=...)"] };
      const slices = await listDraftSlices(slug);
      await updateProject(project.id, (latest) => ({ ...importResult!.project, kind: recomputeProjectKindFromSlices(importResult!.project, slices), revision: latest.revision }));
    }
    const latest = await loadProject(project.id);
    return { ok: true, project_id: latest.id, name: latest.name, slug, revision: latest.revision, created, workspace, root_template: rootTemplate, imports: importResult?.created_slices ?? [], project: summarizeProject(latest, false), next_actions: ["调用 update_plan 记录需求", "调用 create_draft_slice 创建源切片", "调用语义化编辑工具填写内容"] };
  })));

  server.tool("import_existing_json", ImportExistingJsonInputSchema.shape, async (input) => toolText(await logToolCall("import_existing_json", input, async () => {
    const parsed = ImportExistingJsonInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    if (parsed.expected_project_revision !== undefined && project.revision !== parsed.expected_project_revision) throw new Error(`project revision conflict: expected ${parsed.expected_project_revision}, current ${project.revision}`);
    const result = await importExistingJson(project, slug, parsed);
    if (result.candidates) return { ok: false, candidates: result.candidates, warnings: result.warnings };
    const slices = await listDraftSlices(slug);
    const saved = await updateProject(project.id, () => ({ ...result.project, kind: recomputeProjectKindFromSlices(result.project, slices) }));
    return { ok: true, project_id: project.id, import_record: result.importRecord, created_slices: result.created_slices, summary: result.summary, warnings: result.warnings, revision: saved.revision, next_tools: ["list_draft_slices", "validate_project(scope='all')"] };
  })));

  server.tool("list_projects", {}, async () => toolText(await logToolCall("list_projects", {}, async () => ({ projects: (await listProjects()).map((project) => summarizeProject(project, false)) }))));
  server.tool("get_project", GetProjectInputSchema.shape, async (input) => toolText(await logToolCall("get_project", input, async () => {
    const parsed = GetProjectInputSchema.parse(input);
    return summarizeProject(await loadProject(parsed.project_id), parsed.include_content);
  })));
}
