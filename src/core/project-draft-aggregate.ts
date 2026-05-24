import { CharacterCardConfigSchema, type CharacterCardConfig } from "../schemas/character-card.js";
import { DraftSliceDataSchemas, type DraftSlice, type DraftSliceDataSchemasByType } from "../schemas/draft-slice.js";
import type { RegexScriptAsset } from "./mvu-assets.js";
import { EjsConfigSchema, type EjsConfig } from "../schemas/ejs.js";
import { HtmlBeautifyConfigSchema, type HtmlBeautifyConfig } from "../schemas/html-beautify.js";
import { MvuConfigSchema, type MvuConfig } from "../schemas/mvu.js";
import type { Project } from "../schemas/project.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";
import { uniqueStrings } from "../utils/strings.js";
import { listDraftSlices } from "../storage/draft-store.js";

export interface ProjectDraftAggregate {
  worldbookDraft: WorldbookDraftEntry[];
  characterCardConfig?: CharacterCardConfig;
  mvuConfig?: MvuConfig;
  htmlBeautifyConfig?: HtmlBeautifyConfig;
  ejsConfig?: EjsConfig;
  extraRegexScripts: RegexScriptAsset[];
}

export async function aggregateProjectDraft(project: Project): Promise<ProjectDraftAggregate> {
  const slices = await listDraftSlices();
  return aggregateDraftSlices(project, slices);
}

export function aggregateDraftSlices(project: Project, slices: DraftSlice[]): ProjectDraftAggregate {
  const worldbookDraft = enabledSlicesOf(slices, "worldbook_entry")
    .map((slice) => dataOf(slice, "worldbook_entry"))
    .sort((a, b) => a.order - b.order || a.comment.localeCompare(b.comment, "zh-Hans-CN"));

  const profile = lastEnabledSlice(slices, "character_profile");
  const profileData = profile ? dataOf(profile, "character_profile") : undefined;
  const greetings = lastEnabledSlice(slices, "character_greetings");
  const greetingsData = greetings ? dataOf(greetings, "character_greetings") : undefined;
  const characterCardConfig = profileData ? CharacterCardConfigSchema.parse({
    card: {
      ...profileData,
      ...(greetingsData ?? {}),
    },
    worldbook: {
      source: profileData.include_worldbook === false ? "none" : "project_draft",
      name: profileData.worldbook_name ?? profileData.name,
    },
  }) : project.characterCardConfig;

  const mvuSchema = lastEnabledSlice(slices, "mvu_schema");
  const mvuRules = lastEnabledSlice(slices, "mvu_update_rules");
  const mvuConfig = mvuSchema || mvuRules ? MvuConfigSchema.parse({
    ...(mvuSchema ? dataOf(mvuSchema, "mvu_schema") : {}),
    ...(mvuRules ? dataOf(mvuRules, "mvu_update_rules") : {}),
  }) : project.mvuConfig;

  const htmlStatusbar = lastEnabledSlice(slices, "html_statusbar");
  const htmlStatusbarData = htmlStatusbar ? dataOf(htmlStatusbar, "html_statusbar") : undefined;
  const allRegexes = enabledSlicesOf(slices, "html_regex").map((slice) => dataOf(slice, "html_regex"));
  const htmlRegexes = allRegexes.filter((regex) => regex.source === "html" || regex.source === undefined);
  const extraRegexScripts = allRegexes
    .filter((regex) => regex.source !== "html" && regex.source !== undefined)
    .map(toRegexScriptAsset);
  const htmlBeautifyConfig = htmlStatusbarData || htmlRegexes.length > 0 ? HtmlBeautifyConfigSchema.parse({
    ...(htmlStatusbarData ? {
      enabled: htmlStatusbarData.enabled,
      target: htmlStatusbarData.target,
      theme: htmlStatusbarData.theme,
      statusbar: {
        enabled: htmlStatusbarData.enabled,
        html: htmlStatusbarData.html,
        hide_regex: htmlStatusbarData.hide_regex,
      },
    } : {}),
    global: { enabled: htmlRegexes.length > 0, regex_scripts: htmlRegexes.map(stripSource) },
  }) : project.htmlBeautifyConfig;

  const ejsSlices = enabledSlicesOf(slices, "ejs_entry");
  const ejsData = ejsSlices.map((slice) => dataOf(slice, "ejs_entry"));
  const ejsEntries = ejsData.map(stripEjsMetadata);
  const ejsConfig = ejsEntries.length > 0 ? EjsConfigSchema.parse({
    enabled: true,
    template_type: firstString(ejsData.map((data) => data.template_type)) ?? "custom",
    variable_paths: uniqueStrings(ejsData.flatMap((data) => data.variable_paths)),
    entries: ejsEntries,
  }) : project.ejsConfig;

  return { worldbookDraft, characterCardConfig, mvuConfig, htmlBeautifyConfig, ejsConfig, extraRegexScripts };
}

export interface HydratedProject {
  project: Project;
  extraRegexScripts: RegexScriptAsset[];
}

export async function hydrateProjectDraft(project: Project): Promise<HydratedProject> {
  const aggregate = await aggregateProjectDraft(project);
  return { project: projectWithAggregate(project, aggregate), extraRegexScripts: aggregate.extraRegexScripts };
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
  // updatedAt 是 ISO 字符串（同时区、同精度），lexicographic 排序对毫秒级时间是单调的。
  // 边界情形：两次写入落在同一毫秒内时，排序退化为字典序而非真实写入顺序。
  // mvu_schema/mvu_update_rules/character_profile 等类型在实践中通常每个项目只保留 1 份，影响有限；
  // 如果未来出现并发写入同一类型多份的场景，需要改用单调计数器或加上 nanoseconds 字段。
  return enabledSlicesOf(slices, type).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1);
}

function dataOf<T extends DraftSlice["type"]>(slice: DraftSlice & { type: T }, type: T) {
  return DraftSliceDataSchemas[type].parse(slice.data) as DraftSliceDataSchemasByType[T];
}

function stripSource(value: Record<string, unknown>): Record<string, unknown> {
  const { source: _source, ...rest } = value;
  return rest;
}

function stripEjsMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const { source: _source, variable_paths: _variablePaths, template_type: _templateType, ...rest } = value;
  return rest;
}

function toRegexScriptAsset(value: Record<string, unknown>): RegexScriptAsset {
  return {
    scriptName: String(value.name ?? value.scriptName ?? "导入正则"),
    findRegex: String(value.findRegex ?? ""),
    replaceString: String(value.replaceString ?? ""),
    trimStrings: Array.isArray(value.trimStrings) ? value.trimStrings.map(String) : [],
    placement: Array.isArray(value.placement) ? value.placement.map(Number) : [2],
    disabled: Boolean(value.disabled ?? false),
    markdownOnly: Boolean(value.markdownOnly ?? true),
    promptOnly: Boolean(value.promptOnly ?? false),
    runOnEdit: Boolean(value.runOnEdit ?? false),
    substituteRegex: Number(value.substituteRegex ?? 0),
    minDepth: typeof value.minDepth === "number" ? value.minDepth : null,
    maxDepth: typeof value.maxDepth === "number" ? value.maxDepth : null,
  };
}

function firstString(values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}
