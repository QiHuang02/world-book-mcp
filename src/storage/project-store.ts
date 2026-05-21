import fs from "node:fs/promises";
import path from "node:path";
import { ProjectSchema, type Project } from "../schemas/project.js";
import { createId, nowIso } from "../utils/ids.js";
import { safeJsonParse, toPrettyJson } from "../utils/json.js";
import { PROJECTS_DIR } from "./path-policy.js";

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

function projectPath(projectId: string): string {
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

export async function createProject(name: string): Promise<Project> {
  await ensureStorage();
  const timestamp = nowIso();
  const project: Project = {
    id: createId("project"),
    name,
    sources: [],
    research: [],
    patches: [],
    pendingDecisions: [],
    recordedDecisions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await saveProject(project);
  return project;
}

export async function loadProject(projectId: string): Promise<Project> {
  await ensureStorage();
  const text = await fs.readFile(projectPath(projectId), "utf8");
  return ProjectSchema.parse(safeJsonParse(text));
}

export async function saveProject(project: Project): Promise<Project> {
  await ensureStorage();
  const updated = { ...project, updatedAt: nowIso() };
  await fs.writeFile(projectPath(updated.id), toPrettyJson(updated), "utf8");
  return updated;
}

export async function loadOrCreateProject(projectId: string | undefined, fallbackName: string): Promise<Project> {
  if (projectId) {
    return loadProject(projectId);
  }
  return createProject(fallbackName);
}

export async function listProjects(): Promise<Project[]> {
  await ensureStorage();
  const files = await fs.readdir(PROJECTS_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const text = await fs.readFile(path.join(PROJECTS_DIR, file), "utf8");
    projects.push(ProjectSchema.parse(safeJsonParse(text)));
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function summarizeProject(project: Project, includeContent = false): unknown {
  return {
    id: project.id,
    name: project.name,
    sources: includeContent ? project.sources : project.sources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      tags: source.tags,
      characters: source.content.length,
      createdAt: source.createdAt,
    })),
    research: project.research.map((bundle) => ({
      id: bundle.id,
      topic: bundle.topic,
      item_count: bundle.items.length,
      items: includeContent ? bundle.items : undefined,
      createdAt: bundle.createdAt,
    })),
    has_extraction: Boolean(project.extraction),
    extraction_summary: project.extraction ? {
      title: project.extraction.title,
      character_count: project.extraction.characters.length,
      world_fact_count: project.extraction.world.length,
      item_count: project.extraction.items.length,
      event_count: project.extraction.events.length,
    } : undefined,
    has_worldbuilding_summary: Boolean(project.worldbuildingSummary),
    worldbuilding_summary: includeContent ? project.worldbuildingSummary : undefined,
    plan_count: project.plan?.length ?? 0,
    draft_count: project.draft?.length ?? 0,
    importedWorldbookPath: project.importedWorldbookPath,
    patch_count: project.patches?.length ?? 0,
    patches: includeContent ? project.patches : project.patches?.map((patch) => ({ id: patch.id, operation_count: patch.operations.length, createdAt: patch.createdAt })),
    has_character_card_config: Boolean(project.characterCardConfig),
    character_card_name: project.characterCardConfig?.card.name,
    has_mvu_config: Boolean(project.mvuConfig),
    mvu_enabled: project.mvuConfig?.enabled,
    has_html_beautify_config: Boolean(project.htmlBeautifyConfig),
    html_beautify_enabled: project.htmlBeautifyConfig?.enabled,
    html_beautify_target: project.htmlBeautifyConfig?.target,
    has_ejs_config: Boolean(project.ejsConfig),
    ejs_enabled: project.ejsConfig?.enabled,
    ejs_template_type: project.ejsConfig?.template_type,
    characterCardConfig: includeContent ? project.characterCardConfig : undefined,
    mvuConfig: includeContent ? project.mvuConfig : undefined,
    htmlBeautifyConfig: includeContent ? project.htmlBeautifyConfig : undefined,
    ejsConfig: includeContent ? project.ejsConfig : undefined,
    draft: includeContent ? project.draft : undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
