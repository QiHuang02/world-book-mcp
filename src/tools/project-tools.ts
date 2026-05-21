import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IngestTextSourceInputSchema } from "../schemas/source.js";
import { IngestWebResearchInputSchema } from "../schemas/research.js";
import { listProjects, loadOrCreateProject, loadProject, saveProject, summarizeProject } from "../storage/project-store.js";
import { createId, nowIso } from "../utils/ids.js";
import { toolText } from "./helpers.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("list_projects", {}, async () => {
    const projects = await listProjects();
    return toolText({ projects: projects.map((project) => summarizeProject(project, false)) });
  });

  server.tool("get_project", { project_id: z.string(), include_content: z.boolean().default(false) }, async (input) => {
    const project = await loadProject(input.project_id);
    return toolText(summarizeProject(project, input.include_content));
  });

  server.tool("ingest_text_source", IngestTextSourceInputSchema.shape, async (input) => {
    const parsed = IngestTextSourceInputSchema.parse(input);
    const project = await loadOrCreateProject(parsed.project_id, parsed.title);
    const source = {
      id: createId("source"),
      title: parsed.title,
      sourceType: parsed.source_type,
      content: parsed.content,
      sourceUrl: parsed.source_url,
      tags: parsed.tags,
      createdAt: nowIso(),
    };
    const saved = await saveProject({ ...project, sources: [...project.sources, source] });
    return toolText({ project_id: saved.id, source_id: source.id, title: source.title, characters: source.content.length, recommended_next_tool: "create_extraction_outline" });
  });

  server.tool("ingest_web_research", IngestWebResearchInputSchema.shape, async (input) => {
    const parsed = IngestWebResearchInputSchema.parse(input);
    const project = await loadOrCreateProject(parsed.project_id, parsed.topic);
    const research = { id: createId("research"), topic: parsed.topic, items: parsed.items, createdAt: nowIso() };
    const saved = await saveProject({ ...project, research: [...project.research, research] });
    return toolText({ project_id: saved.id, research_id: research.id, item_count: research.items.length, recommended_next_tool: "create_extraction_outline" });
  });
}
