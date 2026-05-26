import { CharacterCardConfigSchema, type CharacterCardConfig } from "../schemas/character-card.js";
import { DraftSliceDataSchemas, type DraftSlice, type DraftSliceDataSchemasByType } from "../schemas/draft-slice.js";
import { EjsConfigSchema, type EjsConfig } from "../schemas/ejs.js";
import { HtmlBeautifyConfigSchema, type HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import { MvuConfigSchema, type MvuConfig } from "../schemas/mvu.js";
import type { Project } from "../schemas/project.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { listDraftSlices } from "../storage/draft-store.js";
import { requireSlugByProjectId } from "../storage/workspace-store.js";
import { uniqueStrings } from "../utils/strings.js";
import type { RegexScriptAsset } from "./mvu-assets.js";

export interface ProjectDraftAggregate {
  worldbookDraft: WorldbookDraftEntry[];
  characterCardConfig?: CharacterCardConfig;
  mvuConfig?: MvuConfig;
  htmlBeautifyConfig?: HtmlBeautifyConfig;
  ejsConfig?: EjsConfig;
  extraRegexScripts: RegexScriptAsset[];
}

export async function aggregateProjectDraft(project: Project, slug?: string): Promise<ProjectDraftAggregate> {
  const resolvedSlug = slug ?? await requireSlugByProjectId(project.id);
  const slices = await listDraftSlices(resolvedSlug);
  return aggregateDraftSlices(project, slices);
}

export function aggregateDraftSlices(project: Project, slices: DraftSlice[]): ProjectDraftAggregate {
  const worldbookDraft = enabledSlicesOf(slices, "entry")
    .map((slice) => dataOf(slice, "entry"))
    .sort((a, b) => a.order - b.order || a.comment.localeCompare(b.comment, "zh-Hans-CN"));

  const characterCardConfig = project.profile ? CharacterCardConfigSchema.parse({
    card: {
      ...project.profile,
      ...(project.greetings ?? {}),
    },
    worldbook: {
      source: project.profile.include_worldbook === false ? "none" : "project_draft",
      name: project.profile.worldbook_name ?? project.profile.name,
    },
  }) : project.characterCardConfig;

  const mvuSlice = lastEnabledSlice(slices, "mvu");
  const mvuConfig = mvuSlice ? MvuConfigSchema.parse(dataOf(mvuSlice, "mvu")) : project.mvuConfig;

  const htmlSlice = lastEnabledSlice(slices, "html");
  const htmlBeautifyConfig = htmlSlice ? HtmlBeautifyConfigSchema.parse(dataOf(htmlSlice, "html")) : project.htmlBeautifyConfig;

  const ejsData = enabledSlicesOf(slices, "ejs").map((slice) => dataOf(slice, "ejs"));
  const ejsEntries = ejsData.map(stripEjsMetadata);
  const ejsConfig = ejsEntries.length > 0 ? EjsConfigSchema.parse({
    enabled: true,
    template_type: firstString(ejsData.map((data) => data.template_type)) ?? "custom",
    variable_paths: uniqueStrings(ejsData.flatMap((data) => data.variable_paths)),
    entries: ejsEntries,
  }) : project.ejsConfig;

  return { worldbookDraft, characterCardConfig, mvuConfig, htmlBeautifyConfig, ejsConfig, extraRegexScripts: project.extraRegexScripts ?? [] };
}

export interface HydratedProject {
  project: Project;
  slug: string;
  extraRegexScripts: RegexScriptAsset[];
}

export async function hydrateProjectDraft(project: Project, slug?: string): Promise<HydratedProject> {
  const resolvedSlug = slug ?? await requireSlugByProjectId(project.id);
  const aggregate = await aggregateProjectDraft(project, resolvedSlug);
  return { project: projectWithAggregate(project, aggregate), slug: resolvedSlug, extraRegexScripts: aggregate.extraRegexScripts };
}

export function projectWithAggregate(project: Project, aggregate: ProjectDraftAggregate): Project {
  return {
    ...project,
    draft: aggregate.worldbookDraft,
    characterCardConfig: aggregate.characterCardConfig,
    mvuConfig: aggregate.mvuConfig,
    htmlBeautifyConfig: aggregate.htmlBeautifyConfig,
    ejsConfig: aggregate.ejsConfig,
  };
}

function enabledSlicesOf<T extends DraftSlice["type"]>(slices: DraftSlice[], type: T): Array<DraftSlice & { type: T }> {
  return slices.filter((slice): slice is DraftSlice & { type: T } => slice.enabled && slice.type === type);
}

function lastEnabledSlice<T extends DraftSlice["type"]>(slices: DraftSlice[], type: T): (DraftSlice & { type: T }) | undefined {
  return enabledSlicesOf(slices, type).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1);
}

function dataOf<T extends DraftSlice["type"]>(slice: DraftSlice & { type: T }, type: T) {
  return DraftSliceDataSchemas[type].parse(slice.data) as DraftSliceDataSchemasByType[T];
}

function stripEjsMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const { source: _source, variable_paths: _variablePaths, template_type: _templateType, ...rest } = value;
  return rest;
}

function firstString(values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}
