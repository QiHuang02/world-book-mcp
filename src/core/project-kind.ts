import type { DraftSlice, DraftType } from "../schemas/draft-slice.js";
import type { Project, ProjectKind, RegexAssetKindState } from "../schemas/project.js";
import type { RegexAssetSource } from "../schemas/regex.js";

export function recomputeProjectKindFromSlices(project: Project, slices: DraftSlice[]): ProjectKind {
  const active = slices.filter((slice) => slice.active);
  const count = (type: DraftType) => active.filter((slice) => slice.type === type).length;
  const imported = (type: DraftType) => active.some((slice) => slice.type === type && slice.source === "imported");
  const generated = (type: DraftType) => active.some((slice) => slice.type === type && slice.source === "generated");
  const regexSources = regexSourcesFromSlices(project, active);
  return {
    ...project.kind,
    assets: {
      mvu: { ...project.kind.assets.mvu, enabled: count("mvu") > 0, imported: imported("mvu"), generated: generated("mvu"), slice_count: count("mvu") },
      html: { ...project.kind.assets.html, enabled: count("html") > 0, imported: imported("html"), generated: generated("html"), slice_count: count("html") },
      regex: { ...project.kind.assets.regex, enabled: regexSources.length > 0 || count("regex") > 0, imported: imported("regex"), generated: generated("regex"), slice_count: count("regex"), sources: regexSources },
      ejs: { ...project.kind.assets.ejs, enabled: count("ejs") > 0, imported: imported("ejs"), generated: generated("ejs"), slice_count: count("ejs") },
    },
  };
}

export function markAssetPlanned(project: Project, assets: Partial<Record<"mvu" | "html" | "regex" | "ejs", boolean>>): Project {
  return {
    ...project,
    kind: {
      ...project.kind,
      assets: {
        ...project.kind.assets,
        mvu: { ...project.kind.assets.mvu, planned: project.kind.assets.mvu.planned || Boolean(assets.mvu) },
        html: { ...project.kind.assets.html, planned: project.kind.assets.html.planned || Boolean(assets.html) },
        regex: { ...project.kind.assets.regex, planned: project.kind.assets.regex.planned || Boolean(assets.regex) },
        ejs: { ...project.kind.assets.ejs, planned: project.kind.assets.ejs.planned || Boolean(assets.ejs) },
      },
    },
  };
}

function regexSourcesFromSlices(project: Project, active: DraftSlice[]): RegexAssetKindState["sources"] {
  const sources = new Set<RegexAssetSource>(project.kind.assets.regex.sources);
  if (active.some((slice) => slice.type === "regex")) sources.add("standalone");
  for (const slice of active) {
    if (slice.type === "mvu") sources.add("mvu");
    if (slice.type === "html") sources.add("html");
    if (slice.type === "regex" && slice.source === "imported") sources.add("third_party");
  }
  return [...sources].sort();
}
