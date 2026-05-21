import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildChapterWorldbookEntries, createChapterExtractionTemplate } from "../core/chapter-extraction.js";
import { buildStyleWorldbookEntries, createStyleExtractionTemplate } from "../core/style-extraction.js";
import { ChapterOutlineSchema } from "../schemas/chapter-outline.js";
import { StyleProfileSchema } from "../schemas/style-profile.js";
import { loadProject, saveProject } from "../storage/project-store.js";
import { toolText } from "./helpers.js";

export function registerStyleChapterTools(server: McpServer): void {
  server.tool("create_style_extraction_template", { project_id: z.string().optional() }, async (input) => toolText({ project_id: input.project_id, ...createStyleExtractionTemplate(), recommended_next_tool: "submit_style_profile" }));

  server.tool("submit_style_profile", { project_id: z.string(), profile: StyleProfileSchema }, async (input) => {
    const project = await loadProject(input.project_id);
    const saved = await saveProject({ ...project, styleProfile: input.profile });
    return toolText({ project_id: saved.id, recommended_next_tool: "build_style_worldbook_entries" });
  });

  server.tool("build_style_worldbook_entries", { project_id: z.string().optional(), profile: StyleProfileSchema.optional(), include_forbidden_entry: z.boolean().optional(), comment_prefix: z.string().optional() }, async (input) => {
    const profile = input.profile ?? (input.project_id ? (await loadProject(input.project_id)).styleProfile : undefined);
    if (!profile) throw new Error("需要传入 profile 或已保存 styleProfile 的 project_id");
    return toolText(buildStyleWorldbookEntries(profile, { include_forbidden_entry: input.include_forbidden_entry, comment_prefix: input.comment_prefix }));
  });

  server.tool("create_chapter_extraction_template", { project_id: z.string().optional(), title: z.string().optional(), chapter_count: z.number().int().min(1).max(30).optional() }, async (input) => toolText({ project_id: input.project_id, outline: createChapterExtractionTemplate(input), recommended_next_tool: "build_chapter_worldbook_entries" }));

  server.tool("build_chapter_worldbook_entries", { project_id: z.string().optional(), outline: ChapterOutlineSchema.optional(), base_order: z.number().int().optional(), comment_prefix: z.string().optional() }, async (input) => {
    let outline = input.outline;
    if (!outline && input.project_id) {
      const project = await loadProject(input.project_id);
      outline = project.chapterOutline;
      if (!outline && project.derivativeOutline?.chapter_index?.length) {
        outline = { title: project.derivativeOutline.title, chapters: project.derivativeOutline.chapter_index.map((chapter) => ({ title: chapter.chapter, startLine: chapter.startLine, endLine: chapter.endLine, summary: chapter.summary, key_events: [], character_state_changes: [], world_changes: [], item_ability_reveals: [], keys: [] })) };
      }
    }
    if (!outline) throw new Error("需要传入 outline 或已保存 chapterOutline / derivativeOutline 的 project_id");
    if (input.project_id) {
      const project = await loadProject(input.project_id);
      await saveProject({ ...project, chapterOutline: outline });
    }
    return toolText(buildChapterWorldbookEntries(outline, { base_order: input.base_order, comment_prefix: input.comment_prefix }));
  });
}
