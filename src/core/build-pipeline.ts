import path from "node:path";
import { createBuildCacheReader, artifactCache, targetFingerprint, type BuildCacheReader, type CacheableBuildTarget } from "./build-cache.js";
import { buildCharacterCardJsonFromProject } from "./character-card-project-builder.js";
import { buildProjectAssets } from "./project-assets.js";
import { validateProject } from "./project-validator.js";
import { createDeliveryChecklist } from "./delivery-checklist.js";
import { aggregateProjectDraft, projectWithAggregate } from "./project-draft-aggregate.js";
import { buildWorldbookJson } from "./worldbook-builder.js";
import type { Project } from "../schemas/project.js";
import type { BuildManifest } from "../schemas/build-artifact.js";
import { draftSlicePath, listDraftSlices } from "../storage/draft-store.js";
import { createBuildId, fileSnapshot, readBuildLatest, readBuildManifest, verifyFileHash, writeBuildArtifact, writeBuildLatest, writeBuildManifest } from "../storage/build-store.js";
import { projectYamlPath, projectPlanPath } from "../storage/workspace-store.js";

export async function buildProjectRun(input: { project: Project; slug: string; target?: "mvu" | "html" | "regex" | "ejs" | "all"; include_previews?: boolean; requested_by?: "build_assets" | "generate_json" | "check_delivery" | "manual"; strict_review?: "off" | "standard" | "strict"; force?: boolean }): Promise<{ ok: boolean; manifest: BuildManifest; manifest_path: string; artifacts: BuildManifest["artifacts"]; previews: unknown[]; validation_report: ReturnType<typeof validateProject> }> {
  const target = input.target ?? "all";
  const includePreviews = input.include_previews ?? target === "all";
  const strictReview = input.strict_review ?? "off";
  const buildId = createBuildId();
  const builtAt = new Date().toISOString();
  const slices = await listDraftSlices(input.slug);
  const aggregate = await aggregateProjectDraft(input.project, input.slug);
  const hydrated = projectWithAggregate(input.project, aggregate);
  const validation = validateProject(hydrated, { scope: "all" });
  const readyToBuild = isReadyToBuild(validation);
  const status: BuildManifest["status"] = readyToBuild || input.force ? readyToBuild ? "success" : "partial" : "failed";
  const artifacts: BuildManifest["artifacts"] = [];
  const previews: unknown[] = [];
  const inputSliceIds = slices.map((slice) => slice.id);
  const inputRevisions = Object.fromEntries(slices.map((slice) => [slice.id, slice.revision]));
  const cacheContext = { project: input.project, target, strict_review: strictReview, include_previews: includePreviews, slices };
  const cache = await createBuildCacheReader(input.slug, status !== "failed" && !input.force);

  if (status !== "failed") {
    const assets = buildProjectAssets(hydrated, target, aggregate.regexSlices, builtAt);
    if (target === "mvu" || target === "all") await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "mvu", relativePath: "assets/mvu.yaml", value: { target: "mvu", builtAt, worldbookEntries: assets.worldbook_entries, tavernHelperScripts: assets.tavern_helper_scripts }, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "mvu") });
    if (target === "html" || target === "all") await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "html", relativePath: "assets/html.yaml", value: { target: "html", builtAt }, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "html") });
    if (target === "regex" || target === "all") await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "regex", relativePath: "assets/regex.yaml", value: assets.regex_artifact, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "regex") });
    if (target === "ejs" || target === "all") await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "ejs", relativePath: "assets/ejs.yaml", value: { target: "ejs", builtAt, worldbookEntries: assets.ejs_entries }, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "ejs") });
    if (target === "all") await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "all", relativePath: "assets/all.yaml", value: assets, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "all") });

    if (includePreviews) {
      if (input.project.kind.output === "worldbook" || input.project.kind.output === "both") {
        const worldbook = buildWorldbookJson({ name: input.project.name, entries: [...aggregate.worldbookDraft, ...assets.worldbook_entries, ...assets.ejs_entries] });
        const artifact = await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "worldbook_preview", relativePath: "exports/worldbook.preview.json", value: worldbook, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "worldbook_preview"), summary: { entry_count: Object.keys(worldbook.entries).length } });
        previews.push({ target: "worldbook", path: artifact.path, sha256: artifact.sha256, bytes: artifact.bytes });
      }
      if (input.project.kind.output === "character_card" || input.project.kind.output === "both") {
        const card = buildCharacterCardJsonFromProject(hydrated, { regexScripts: assets.regex_scripts, tavernHelperScripts: assets.tavern_helper_scripts, worldbookEntries: assets.worldbook_entries, ejsEntries: assets.ejs_entries }).card;
        const artifact = await addArtifact({ slug: input.slug, buildId, artifacts, cache, target: "character_card_preview", relativePath: "exports/character_card.preview.json", value: card, inputSliceIds, inputRevisions, fingerprint: targetFingerprint(cacheContext, "character_card_preview"), summary: { name: card.name, greeting_count: card.data.alternate_greetings.length + 1 } });
        previews.push({ target: "character_card", path: artifact.path, sha256: artifact.sha256, bytes: artifact.bytes });
      }
    }
  }

  const delivery = validateProject(hydrated, { scope: "delivery", build: { stale: false, stale_reasons: [] } });
  const checklist = createDeliveryChecklist({ project: input.project, review: delivery, export_target: input.project.kind.output });
  const validationArtifact = await writeBuildArtifact(input.slug, buildId, "validation-report.yaml", validation);
  const checklistArtifact = await writeBuildArtifact(input.slug, buildId, "delivery-checklist.yaml", checklist);
  const projectInput = await fileSnapshot(projectYamlPath(input.slug), input.project.revision);
  let planInput; try { planInput = await fileSnapshot(projectPlanPath(input.slug)); } catch { /* no plan */ }
  const sliceInputs = await Promise.all(slices.map(async (slice) => ({ ...await fileSnapshot(draftSlicePath(input.slug, slice.type, slice.id), slice.revision), id: slice.id, type: slice.type, title: slice.title, active: slice.active, revision: slice.revision, source: slice.source })));
  const manifest: BuildManifest = {
    schema_version: 2,
    build_id: buildId,
    status,
    built_at: builtAt,
    tool: { name: "world-book-mcp", version: "0.1.0-beta.0", node_version: process.version },
    project: { project_id: input.project.id, slug: input.project.slug, name: input.project.name, project_revision: input.project.revision, kind: input.project.kind },
    build: { requested_by: input.requested_by ?? "build_assets", target, mode: "full", strict_review: strictReview, force: Boolean(input.force) },
    inputs: { project_yaml: projectInput, plan_md: planInput, slices: sliceInputs, imports: input.project.imports.map((item) => ({ importId: item.importId, path: item.path, type: item.type, sha256_at_import: item.sourceHash, changed_since_import: false })) },
    graph: { nodes: [], edges: [] },
    artifacts,
    validation: { validated: true, validate_tool: "validate_project", scope: "all", ok: validation.ok, ready_to_build: readyToBuild, ready_to_export: validation.ready_to_export, section_status: Object.fromEntries(Object.entries(validation.sections).map(([key, section]) => [key, section.status])), error_count: validation.summary.blocking_count, warning_count: validation.summary.warning_count, info_count: validation.summary.info_count, report_path: validationArtifact.path },
    delivery: { checked: true, export_target: input.project.kind.output, ready_to_export: delivery.ready_to_export, blocking_count: checklist.blocking_count, warning_count: checklist.warning_count, checklist_path: checklistArtifact.path, blocking_sections: checklist.items.filter((i) => i.blocking).map((i) => i.section), warning_sections: checklist.items.filter((i) => i.status === "warning").map((i) => i.section) },
    exports: { previews, final_exports: [] },
    diagnostics: { stale: false, stale_reasons: [], warnings: cache.diagnostics.warnings, infos: cache.diagnostics.infos },
  };
  const manifestPath = await writeBuildManifest(input.slug, manifest);
  if (manifest.status === "success") await writeBuildLatest(input.slug, manifest, manifestPath);
  return { ok: manifest.status === "success", manifest, manifest_path: manifestPath, artifacts, previews, validation_report: validation };
}

function isReadyToBuild(validation: ReturnType<typeof validateProject>): boolean {
  return Object.entries(validation.sections).every(([key, section]) => key === "build" || key === "delivery" || section.status !== "blocking");
}

async function addArtifact(input: { slug: string; buildId: string; artifacts: BuildManifest["artifacts"]; cache: BuildCacheReader; target: CacheableBuildTarget; relativePath: string; value: unknown; inputSliceIds: string[]; inputRevisions: Record<string, number>; fingerprint: string; summary?: unknown }): Promise<BuildManifest["artifacts"][number]> {
  const reused = await input.cache.reuseArtifact({ slug: input.slug, buildId: input.buildId, target: input.target, relativePath: input.relativePath, fingerprint: input.fingerprint });
  if (reused) {
    const artifact = { ...reused, id: String(input.target), target: input.target, input_slice_ids: input.inputSliceIds, input_revisions: input.inputRevisions, summary: input.summary ?? reused.summary, cache: reused.cache ?? { fingerprint: input.fingerprint }, stale: false };
    input.artifacts.push(artifact);
    return artifact;
  }
  const written = await writeBuildArtifact(input.slug, input.buildId, input.relativePath, input.value);
  const artifact: BuildManifest["artifacts"][number] = { id: String(input.target), target: input.target, path: written.path, media_type: input.relativePath.endsWith(".json") ? "application/json" : "application/yaml", sha256: written.sha256, bytes: written.bytes, created_at: new Date().toISOString(), input_slice_ids: input.inputSliceIds, input_revisions: input.inputRevisions, summary: input.summary ?? (input.value as { summary?: unknown }).summary, cache: artifactCache(input.fingerprint), stale: false };
  input.artifacts.push(artifact);
  return artifact;
}

export async function loadFreshBuild(input: { slug: string; build_id?: string }): Promise<{ manifest?: BuildManifest; stale: boolean; stale_reasons: string[] }> {
  const latest = input.build_id ? undefined : await readBuildLatest(input.slug);
  const buildId = input.build_id ?? latest?.build_id;
  if (!buildId) return { stale: true, stale_reasons: ["missing build"] };
  const manifest = await readBuildManifest(input.slug, buildId);
  const stale_reasons: string[] = [];
  for (const artifact of manifest.artifacts) if (!await verifyFileHash(artifact.path, artifact.sha256)) stale_reasons.push(`artifact hash mismatch: ${artifact.target}`);
  await appendInputStaleReasons(input.slug, manifest, stale_reasons);
  return { manifest, stale: stale_reasons.length > 0, stale_reasons };
}

async function appendInputStaleReasons(slug: string, manifest: BuildManifest, staleReasons: string[]): Promise<void> {
  if (!await verifyFileHash(manifest.inputs.project_yaml.path, manifest.inputs.project_yaml.sha256)) staleReasons.push("input project_yaml changed");
  if (manifest.inputs.plan_md && !await verifyFileHash(manifest.inputs.plan_md.path, manifest.inputs.plan_md.sha256)) staleReasons.push("input plan_md changed");
  for (const slice of manifest.inputs.slices) if (!await verifyFileHash(slice.path, slice.sha256)) staleReasons.push(`input slice changed or missing: ${slice.type}/${slice.id}`);

  const currentSlices = await listDraftSlices(slug);
  const recorded = new Map(manifest.inputs.slices.map((slice) => [`${slice.type}:${slice.id}`, slice]));
  const currentKeys = new Set(currentSlices.map((slice) => `${slice.type}:${slice.id}`));
  for (const key of recorded.keys()) if (!currentKeys.has(key)) staleReasons.push(`input slice removed: ${key}`);
  for (const slice of currentSlices) {
    const key = `${slice.type}:${slice.id}`;
    const previous = recorded.get(key);
    if (!previous) { staleReasons.push(`input slice added: ${key}`); continue; }
    const current = await fileSnapshot(draftSlicePath(slug, slice.type, slice.id), slice.revision);
    if (previous.revision !== current.revision || previous.sha256 !== current.sha256 || previous.active !== slice.active) staleReasons.push(`input slice snapshot changed: ${key}`);
  }
}
