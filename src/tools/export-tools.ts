import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCharacterCardJsonFromProject } from "../core/character-card-project-builder.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { buildProjectAssets } from "../core/project-assets.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { validateProject } from "../core/project-validator.js";
import { buildWorldbookJson } from "../core/worldbook-builder.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { BuildAssetsInputSchema, GenerateJsonInputSchema, QueryJsonInputSchema, ValidateDraftInputSchema } from "../schemas/draft-slice.js";
import { assertInside, CARDS_DIR, EXPORTS_DIR, resolveCardExportPath, resolveExportPath, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject, loadProjectWithSlug } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toPrettyJson } from "../utils/json.js";
import { toolText } from "./helpers.js";

export function registerExportTools(server: McpServer): void {
  server.tool("validate_draft", ValidateDraftInputSchema.shape, async (input) => toolText(await logToolCall("validate_draft", input, async () => {
    const parsed = ValidateDraftInputSchema.parse(input);
    const { project: loaded, slug } = await loadProjectWithSlug(parsed.project_id);
    const { project } = await hydrateProjectDraft(loaded, slug);
    return { project_id: parsed.project_id, ...validateProject(project, { scope: parsed.scope, strict: parsed.strict }) };
  })));

  server.tool("build_assets", BuildAssetsInputSchema.shape, async (input) => toolText(await logToolCall("build_assets", input, async () => {
    const parsed = BuildAssetsInputSchema.parse(input);
    const { project: loaded, slug } = await loadProjectWithSlug(parsed.project_id);
    const { project, extraRegexScripts } = await hydrateProjectDraft(loaded, slug);
    const assets = buildProjectAssets(project, parsed.target, extraRegexScripts);
    const validation = validateProject(project, { scope: "assets" });
    return { ok: validation.ready_to_export, project_id: parsed.project_id, validation, assets };
  })));

  server.tool("generate_json", GenerateJsonInputSchema.shape, async (input) => toolText(await logToolCall("generate_json", input, async () => {
    const parsed = GenerateJsonInputSchema.parse(input);
    const { project: loaded, slug } = await loadProjectWithSlug(parsed.project_id);
    const { project, extraRegexScripts } = await hydrateProjectDraft(loaded, slug);
    const target = parsed.target ?? project.plan.output_target;
    if (!target) throw new Error("未指定导出目标，请在 generate_json.target 或 plan.output_target 中指定 worldbook/character_card/both");

    const targets = target === "both" ? ["worldbook", "character_card"] as const : [target] as const;
    const checklists = targets.map((item) => createDeliveryChecklist({ project, export_target: item, strict_review: parsed.strict_review }));
    const blocking = checklists.find((checklist) => !checklist.ready_to_export);
    if (blocking && !parsed.force) return { ok: false, error: "delivery gate 未通过，默认拒绝导出；如确需导出请显式传 force=true", checklist: blocking, checklists };

    const outputs: Array<{ target: string; path: string; name: string; entry_count?: number }> = [];
    if (target === "worldbook" || target === "both") {
      const name = project.plan.export_filename ?? project.name;
      const book = buildWorldbookJson({ name, entries: project.draft ?? [] });
      const outputPath = resolveWorldbookOutputPath({ explicitPath: target === "both" ? undefined : parsed.output_path, importedPath: project.importedWorldbookPath, fallbackName: name });
      await writeTextFileSafely(outputPath, toPrettyJson(book), { overwrite: parsed.overwrite || outputPath === project.importedWorldbookPath });
      outputs.push({ target: "worldbook", path: outputPath, name, entry_count: Object.keys(book.entries).length });
    }
    if (target === "character_card" || target === "both") {
      if (!project.characterCardConfig) throw new Error("缺少 project.profile / characterCardConfig，无法导出角色卡");
      const { card } = buildCharacterCardJsonFromProject(project, extraRegexScripts);
      const outputPath = resolveCharacterCardOutputPath({ explicitPath: target === "both" ? undefined : parsed.output_path, importedPath: project.importedCharacterCardPath, fallbackName: project.characterCardConfig.card.name });
      await writeTextFileSafely(outputPath, toPrettyJson(card), { overwrite: parsed.overwrite || outputPath === project.importedCharacterCardPath });
      outputs.push({ target: "character_card", path: outputPath, name: card.name, entry_count: card.data.character_book.entries.length });
    }
    return { ok: true, project_id: parsed.project_id, forced: parsed.force, checklists, outputs };
  })));

  server.tool("query_json", QueryJsonInputSchema.shape, async (input) => toolText(await logToolCall("query_json", input, async () => {
    const parsed = QueryJsonInputSchema.parse(input);
    if (parsed.mode === "summary" || parsed.mode === "worldbook_entries" || parsed.mode === "greetings") return queryCharacterCard({ path: parsed.path, mode: parsed.mode });
    return queryWorldbook({ path: parsed.path, mode: parsed.mode, query: parsed.query, uid: parsed.uid });
  })));
}

export function resolveWorldbookOutputPath(input: { explicitPath?: string; importedPath?: string; fallbackName: string }): string {
  if (input.explicitPath?.trim()) return resolveExportPath(input.explicitPath, input.fallbackName);
  if (input.importedPath) return assertInside(EXPORTS_DIR, input.importedPath);
  return resolveExportPath(undefined, input.fallbackName);
}

export function resolveCharacterCardOutputPath(input: { explicitPath?: string; importedPath?: string; fallbackName: string }): string {
  if (input.explicitPath?.trim()) return resolveCardExportPath(input.explicitPath, input.fallbackName);
  if (input.importedPath) return assertInside(CARDS_DIR, input.importedPath);
  return resolveCardExportPath(undefined, input.fallbackName);
}
