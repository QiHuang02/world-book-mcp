import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listProjects, loadProject, summarizeProject } from "../storage/project-store.js";
import { ensureRootTemplateJson, initWorkspaceProject } from "../storage/workspace-store.js";
import { toolText } from "./helpers.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("init_project", {
    name: z.string().min(1),
    kind: z.enum(["worldbook", "character_card", "mixed"]).default("worldbook"),
    project_id: z.string().optional(),
    if_exists: z.enum(["error", "return_existing", "overwrite"]).default("error"),
  }, async (input) => {
    const { project, created, workspace } = await initWorkspaceProject({ name: input.name, projectId: input.project_id, ifExists: input.if_exists });
    const rootTemplate = await ensureRootTemplateJson({ name: input.name, kind: input.kind });
    return toolText({
      project_id: project.id,
      name: project.name,
      kind: input.kind,
      revision: project.revision,
      created,
      workspace,
      root_template: rootTemplate,
      project: summarizeProject(project, false),
    });
  });

  server.tool("list_projects", {}, async () => {
    const projects = await listProjects();
    return toolText({ projects: projects.map((project) => summarizeProject(project, false)) });
  });

  server.tool("get_project", { project_id: z.string(), include_content: z.boolean().default(false) }, async (input) => {
    const project = await loadProject(input.project_id);
    return toolText(summarizeProject(project, input.include_content));
  });
}
