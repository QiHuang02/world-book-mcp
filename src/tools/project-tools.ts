import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importExistingTavernJsonFiles } from "../core/project-initializer.js";
import { aggregateProjectDraft, hydrateProjectDraft, projectWithAggregate } from "../core/project-draft-aggregate.js";
import { listProjects, loadProject, loadProjectWithSlug, summarizeProject, updateProject } from "../storage/project-store.js";
import { ensureRootTemplateJson, initWorkspaceProject } from "../storage/workspace-store.js";
import { logToolCall } from "../storage/tool-log.js";
import type { ProjectImportRecord } from "../schemas/project.js";
import { toolText } from "./helpers.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("init_project", {
    name: z.string().min(1),
    kind: z.enum(["worldbook", "character_card", "mixed"]).default("worldbook"),
    project_id: z.string().optional(),
    if_exists: z.enum(["error", "return_existing", "overwrite"]).default("error"),
    scan_existing: z.boolean().default(true),
    import_strategy: z.enum(["auto", "ask", "none"]).default("auto"),
  }, async (input) => toolText(await logToolCall("init_project", input, async () => {
    const { project, created, workspace, slug } = await initWorkspaceProject({ name: input.name, projectId: input.project_id, kind: input.kind, ifExists: input.if_exists });
    const rootTemplate = await ensureRootTemplateJson({ name: input.name, kind: input.kind });
    let imports: Awaited<ReturnType<typeof importExistingTavernJsonFiles>> | undefined;
    const effectiveImportStrategy = input.import_strategy === "none" ? "none" : "auto";
    if (input.scan_existing && effectiveImportStrategy === "auto") {
      imports = await importExistingTavernJsonFiles(slug);
      if (imports.records.length > 0) {
        await updateProject(project.id, (latest) => ({
          ...latest,
          imports: imports!.records,
          ...imports!.projectPatch,
          ...rootTemplateImportPaths(rootTemplate.path, imports!.records),
        }));
      }
    }
    const latest = await loadProject(project.id);
    const aggregate = await aggregateProjectDraft(latest, slug);
    const summarized = projectWithAggregate(latest, aggregate);
    return {
      project_id: latest.id,
      name: latest.name,
      slug,
      kind: input.kind,
      revision: latest.revision,
      created,
      workspace,
      root_template: rootTemplate,
      import_strategy: input.import_strategy,
      effective_import_strategy: effectiveImportStrategy,
      imports: imports?.summaries ?? [],
      project: summarizeProject(summarized, false),
      next_actions: [
        "向用户确认任务类型、输出目标、MVU/HTML/EJS、文风与导出文件名",
        "调用 update_plan 写入 plan.md",
        "调用 create_draft_slice / update_draft_field 继续创建和填写 draft",
      ],
    };
  })));

  server.tool("list_projects", {}, async () => toolText(await logToolCall("list_projects", {}, async () => {
    const projects = await listProjects();
    return { projects: projects.map((project) => summarizeProject(project, false)) };
  })));

  server.tool("get_project", { project_id: z.string(), include_content: z.boolean().default(false) }, async (input) => toolText(await logToolCall("get_project", input, async () => {
    const { project: loaded, slug } = await loadProjectWithSlug(input.project_id);
    const { project } = await hydrateProjectDraft(loaded, slug);
    return summarizeProject(project, input.include_content);
  })));
}

function rootTemplateImportPaths(templatePath: string | undefined, records: ProjectImportRecord[]): Pick<Awaited<ReturnType<typeof loadProject>>, "importedWorldbookPath" | "importedCharacterCardPath"> {
  if (!templatePath) return {};
  const templateRecord = records.find((record) => record.path === templatePath);
  if (!templateRecord) return {};
  if (templateRecord.type === "worldbook") return { importedWorldbookPath: templatePath };
  return { importedCharacterCardPath: templatePath };
}
