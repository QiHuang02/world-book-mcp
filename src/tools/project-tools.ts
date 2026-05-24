import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importExistingTavernJsonFiles } from "../core/project-initializer.js";
import { aggregateProjectDraft, hydrateProjectDraft, projectWithAggregate } from "../core/project-draft-aggregate.js";
import { listProjects, loadProject, summarizeProject, updateProject } from "../storage/project-store.js";
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
    const { project, created, workspace } = await initWorkspaceProject({ name: input.name, projectId: input.project_id, ifExists: input.if_exists });
    const rootTemplate = await ensureRootTemplateJson({ name: input.name, kind: input.kind });
    let imports: Awaited<ReturnType<typeof importExistingTavernJsonFiles>> | undefined;
    if (input.scan_existing && input.import_strategy === "auto") {
      imports = await importExistingTavernJsonFiles();
      if (imports.records.length > 0) {
        await updateProject(project.id, (latest) => ({
          ...latest,
          imports: imports!.records,
          ...rootTemplateImportPaths(rootTemplate.path, imports!.records),
        }));
      }
    }
    const latest = await loadProject(project.id);
    const aggregate = await aggregateProjectDraft(latest);
    const summarized = projectWithAggregate(latest, aggregate);
    return {
      project_id: latest.id,
      name: latest.name,
      kind: input.kind,
      revision: latest.revision,
      created,
      workspace,
      root_template: rootTemplate,
      imports: imports?.summaries ?? [],
      project: summarizeProject(summarized, false),
      next_actions: [
        "向用户确认任务类型、输出目标、MVU/HTML/EJS、文风与导出文件名",
        "调用 update_plan 写入 .worldbook/plan.md",
        "调用 create_draft_slice / update_draft_field 继续创建和填写 draft",
      ],
    };
  })));

  server.tool("list_projects", {}, async () => {
    const projects = await listProjects();
    return toolText({ projects: projects.map((project) => summarizeProject(project, false)) });
  });

  server.tool("get_project", { project_id: z.string(), include_content: z.boolean().default(false) }, async (input) => {
    const { project } = await hydrateProjectDraft(await loadProject(input.project_id));
    return toolText(summarizeProject(project, input.include_content));
  });
}

function rootTemplateImportPaths(templatePath: string | undefined, records: ProjectImportRecord[]): Pick<Awaited<ReturnType<typeof loadProject>>, "importedWorldbookPath" | "importedCharacterCardPath"> {
  if (!templatePath) return {};
  const templateRecord = records.find((record) => record.path === templatePath);
  if (!templateRecord) return {};
  if (templateRecord.type === "worldbook") return { importedWorldbookPath: templatePath };
  return { importedCharacterCardPath: templatePath };
}
