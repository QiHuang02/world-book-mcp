import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildProjectRun, loadFreshBuild } from "../core/build-pipeline.js";
import { exportFromBuild } from "../core/export-final.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { validateProject } from "../core/project-validator.js";
import { applyStrictReview, normalizeStrictMode } from "../core/strict-review.js";
import { BuildAssetsInputSchema, GenerateJsonInputSchema, QueryJsonInputSchema, ValidateProjectInputSchema } from "./export-tool-schemas.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue } from "../storage/version-manager.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { toolText } from "./helpers.js";

export function registerExportTools(server: McpServer): void {
  server.tool("validate_project", ValidateProjectInputSchema.shape, async (input) => toolText(await logToolCall("validate_project", input, async () => {
    const parsed = ValidateProjectInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    const hydrated = await hydrateProjectDraft(project, slug);
    const build = parsed.scope === "build" || parsed.scope === "delivery" || parsed.scope === "all" ? await loadFreshBuild({ slug, build_id: parsed.build_id }) : undefined;
    return applyStrictReview(validateProject(hydrated.project, { scope: parsed.scope, build }), parsed.strict_review);
  })));

  server.tool("build_assets", BuildAssetsInputSchema.shape, async (input) => toolText(await logToolCall("build_assets", input, async () => {
    const parsed = BuildAssetsInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, parsed.expected_project_revision);
    const result = await buildProjectRun({ project, slug, target: parsed.target, include_previews: parsed.include_previews, requested_by: "build_assets", strict_review: normalizeStrictMode(parsed.strict_review), force: parsed.force });
    return { ok: result.ok, project_id: parsed.project_id, build_id: result.manifest.build_id, status: result.manifest.status, manifest_path: result.manifest_path, artifacts: result.artifacts.map((artifact) => ({ target: artifact.target, path: artifact.path, sha256: artifact.sha256, summary: artifact.summary })), previews: result.previews, validation: result.manifest.validation, next_tools: ["validate_project(scope='delivery', build_id=...)", "generate_json(build_id=...)"] };
  })));

  server.tool("generate_json", GenerateJsonInputSchema.shape, async (input) => toolText(await logToolCall("generate_json", input, async () => {
    const parsed = GenerateJsonInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    const target = parsed.target ?? project.kind.output;
    if (!isTargetAllowed(project.kind.output, target)) throw new Error(`target=${target} 与 project.kind.output=${project.kind.output} 不兼容`);
    let build = parsed.build_id ? await loadFreshBuild({ slug, build_id: parsed.build_id }) : undefined;
    if (!build?.manifest || parsed.rebuild === "always" || (!parsed.build_id && parsed.rebuild !== "never")) {
      const run = await buildProjectRun({ project, slug, target: "all", include_previews: true, requested_by: "generate_json", strict_review: normalizeStrictMode(parsed.strict_review), force: parsed.force });
      build = { manifest: run.manifest, stale: false, stale_reasons: [] };
    }
    if (!build.manifest) throw new Error("没有可用于导出的 build manifest");
    if (build.stale && !parsed.force) throw new Error(`build manifest 已过期：${build.stale_reasons.join("; ")}`);
    if (!build.manifest.delivery.ready_to_export && !parsed.force) throw new Error("delivery gate 未通过；如需强制导出请显式 force=true");
    const exported = await exportFromBuild({ project, slug, manifest: build.manifest, target, output_path: parsed.output_path, output_paths: parsed.output_paths, overwrite: parsed.overwrite, forced: parsed.force, stale: build.stale, stale_reasons: build.stale_reasons });
    return { ok: true, project_id: parsed.project_id, build_id: build.manifest.build_id, export_id: exported.export_record.export_id, forced: parsed.force, target, outputs: exported.export_record.outputs, export_record_path: exported.export_record_path, delivery: exported.export_record.delivery };
  })));

  server.tool("query_json", QueryJsonInputSchema.shape, async (input) => toolText(await logToolCall("query_json", input, async () => {
    const parsed = QueryJsonInputSchema.parse(input);
    if (parsed.mode === "greetings" || parsed.mode === "worldbook_entries") return queryCharacterCard({ path: parsed.path, mode: parsed.mode });
    return queryWorldbook({ path: parsed.path, mode: parsed.mode === "summary" ? "brief" : parsed.mode, query: parsed.query, uid: parsed.uid });
  })));
}
function isTargetAllowed(output: "worldbook" | "character_card" | "both", target: "worldbook" | "character_card" | "both"): boolean { if (output === "both") return true; return output === target; }
