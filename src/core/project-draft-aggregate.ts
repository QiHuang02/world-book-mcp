import { CharacterCardConfigSchema, type CharacterCardConfig } from "../schemas/character-card.js";
import { DraftSliceDataSchemas, type DraftSlice, type DraftSliceDataSchemasByType } from "../schemas/draft-slice.js";
import { EjsConfigSchema, type EjsConfig } from "../schemas/ejs.js";
import { HtmlBeautifyConfigSchema, type HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import { MvuConfigSchema, type MvuConfig } from "../schemas/mvu.js";
import type { RegexSliceData } from "../schemas/regex.js";
import type { Project } from "../schemas/project.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { listDraftSlices } from "../storage/draft-store.js";
import { requireSlugByProjectId } from "../storage/workspace-store.js";

export interface ProjectDraftAggregate {
  worldbookDraft: WorldbookDraftEntry[];
  characterCardConfig?: CharacterCardConfig;
  mvuConfig?: MvuConfig;
  htmlBeautifyConfig?: HtmlBeautifyConfig;
  ejsConfig?: EjsConfig;
  regexSlices: Array<{ id: string; data: RegexSliceData; slice: DraftSlice }>;
}

export async function aggregateProjectDraft(project: Project, slug?: string): Promise<ProjectDraftAggregate> {
  const resolvedSlug = slug ?? await requireSlugByProjectId(project.id);
  return aggregateDraftSlices(project, await listDraftSlices(resolvedSlug));
}

export function aggregateDraftSlices(project: Project, slices: DraftSlice[]): ProjectDraftAggregate {
  const worldbookDraft = activeSlicesOf(slices, "entry").map((slice) => dataOf(slice, "entry")).sort((a, b) => a.order - b.order || a.comment.localeCompare(b.comment, "zh-Hans-CN"));
  const characterCardConfig = project.profile ? CharacterCardConfigSchema.parse({ card: { ...project.profile, ...(project.greetings ?? {}) }, worldbook: { source: project.profile.include_worldbook === false ? "none" : "project_draft", name: project.profile.worldbook_name ?? project.profile.name } }) : undefined;
  const mvuSlice = lastActiveSlice(slices, "mvu");
  const mvuConfig = mvuSlice ? MvuConfigSchema.parse(dataOf(mvuSlice, "mvu")) : undefined;
  const htmlSlice = lastActiveSlice(slices, "html");
  const htmlBeautifyConfig = htmlSlice ? HtmlBeautifyConfigSchema.parse(dataOf(htmlSlice, "html")) : undefined;
  const ejsEntries = activeSlicesOf(slices, "ejs").map((slice) => dataOf(slice, "ejs"));
  const ejsConfig = ejsEntries.length > 0 ? EjsConfigSchema.parse({ entries: ejsEntries }) : undefined;
  const regexSlices = activeSlicesOf(slices, "regex").map((slice) => ({ id: slice.id, data: dataOf(slice, "regex"), slice }));
  return { worldbookDraft, characterCardConfig, mvuConfig, htmlBeautifyConfig, ejsConfig, regexSlices };
}

export interface HydratedProject {
  project: Project & { draft?: WorldbookDraftEntry[]; characterCardConfig?: CharacterCardConfig; mvuConfig?: MvuConfig; htmlBeautifyConfig?: HtmlBeautifyConfig; ejsConfig?: EjsConfig };
  slug: string;
  regexSlices: ProjectDraftAggregate["regexSlices"];
}

export async function hydrateProjectDraft(project: Project, slug?: string): Promise<HydratedProject> {
  const resolvedSlug = slug ?? await requireSlugByProjectId(project.id);
  const aggregate = await aggregateProjectDraft(project, resolvedSlug);
  return { project: projectWithAggregate(project, aggregate), slug: resolvedSlug, regexSlices: aggregate.regexSlices };
}

export function projectWithAggregate(project: Project, aggregate: ProjectDraftAggregate): HydratedProject["project"] {
  return { ...project, draft: aggregate.worldbookDraft, characterCardConfig: aggregate.characterCardConfig, mvuConfig: aggregate.mvuConfig, htmlBeautifyConfig: aggregate.htmlBeautifyConfig, ejsConfig: aggregate.ejsConfig };
}

function activeSlicesOf<T extends DraftSlice["type"]>(slices: DraftSlice[], type: T): Array<DraftSlice & { type: T }> { return slices.filter((slice): slice is DraftSlice & { type: T } => slice.active && slice.type === type); }
function lastActiveSlice<T extends DraftSlice["type"]>(slices: DraftSlice[], type: T): (DraftSlice & { type: T }) | undefined { return activeSlicesOf(slices, type).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1); }
function dataOf<T extends DraftSlice["type"]>(slice: DraftSlice & { type: T }, type: T) { return DraftSliceDataSchemas[type].parse(slice.data) as DraftSliceDataSchemasByType[T]; }
