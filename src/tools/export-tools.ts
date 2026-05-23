import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCharacterCardJsonFromProject } from "../core/character-card-project-builder.js";
import { queryCharacterCard } from "../core/character-card-query.js";
import { validateCharacterCardConfig } from "../core/character-card-validator.js";
import { createDeliveryChecklist } from "../core/delivery-checklist.js";
import { buildProjectAssets } from "../core/project-assets.js";
import { validateEjsConfig } from "../core/ejs-validator.js";
import { validateHtmlBeautifyConfig } from "../core/html-beautify-validator.js";
import { validateMvuConfig } from "../core/mvu-validator.js";
import { hydrateProjectDraft } from "../core/project-draft-aggregate.js";
import { buildWorldbookJson } from "../core/worldbook-builder.js";
import { confirmWorldbookDraftComplete } from "../core/worldbook-draft-editor.js";
import { queryWorldbook } from "../core/worldbook-query.js";
import { BuildAssetsInputSchema, GenerateJsonInputSchema, QueryJsonInputSchema, ValidateDraftInputSchema } from "../schemas/draft-slice.js";
import { resolveCardExportPath, resolveExportPath, writeTextFileSafely } from "../storage/path-policy.js";
import { loadProject } from "../storage/project-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { toPrettyJson } from "../utils/json.js";
import { toolText } from "./helpers.js";

export function registerExportTools(server: McpServer): void {
  server.tool("validate_draft", ValidateDraftInputSchema.shape, async (input) => toolText(await logToolCall("validate_draft", input, async () => {
    const parsed = ValidateDraftInputSchema.parse(input);
    const { project } = await hydrateProjectDraft(await loadProject(parsed.project_id));
    return validateHydratedProject(project, parsed.scope);
  })));

  server.tool("build_assets", BuildAssetsInputSchema.shape, async (input) => toolText(await logToolCall("build_assets", input, async () => {
    const parsed = BuildAssetsInputSchema.parse(input);
    const { project, extraRegexScripts } = await hydrateProjectDraft(await loadProject(parsed.project_id));
    const assets = buildProjectAssets(project, parsed.target, extraRegexScripts);
    const validation = validateHydratedProject(project, "all");
    return { ok: true, project_id: parsed.project_id, validation, assets };
  })));

  server.tool("generate_json", GenerateJsonInputSchema.shape, async (input) => toolText(await logToolCall("generate_json", input, async () => {
    const parsed = GenerateJsonInputSchema.parse(input);
    const { project, extraRegexScripts } = await hydrateProjectDraft(await loadProject(parsed.project_id));
    const target = parsed.target ?? project.plan.output_target;
    if (!target) throw new Error("未指定导出目标，请在 generate_json.target 或 plan.output_target 中指定 worldbook/character_card/both");
    const strict = parsed.strict_review ?? project.plan.strict_review ?? false;
    const validation = validateHydratedProject(project, "all");
    if (!validation.ready_to_merge) return { ok: false, validation };
    const outputs: Array<{ target: string; path: string; name: string; entry_count?: number }> = [];
    if (target === "worldbook" || target === "both") {
      const name = project.plan.export_filename ?? project.name;
      if (strict) {
        const checklist = createDeliveryChecklist({ project, export_target: "worldbook" });
        if (!checklist.ready_to_export) return { ok: false, error: "strict_review 未通过", checklist };
      }
      const book = buildWorldbookJson({ name, entries: project.draft ?? [] });
      const outputPath = resolveExportPath(target === "both" ? undefined : parsed.output_path, name);
      await writeTextFileSafely(outputPath, toPrettyJson(book), { overwrite: parsed.overwrite });
      outputs.push({ target: "worldbook", path: outputPath, name, entry_count: Object.keys(book.entries).length });
    }
    if (target === "character_card" || target === "both") {
      if (!project.characterCardConfig) throw new Error("缺少 character_profile draft，无法导出角色卡");
      if (strict) {
        const checklist = createDeliveryChecklist({ project, export_target: "character_card" });
        if (!checklist.ready_to_export) return { ok: false, error: "strict_review 未通过", checklist };
      }
      const { card, validation: cardValidation } = buildCharacterCardJsonFromProject(project, extraRegexScripts);
      if (!cardValidation.valid) return { ok: false, validation: cardValidation };
      const outputPath = resolveCardExportPath(target === "both" ? undefined : parsed.output_path, project.characterCardConfig.card.name);
      await writeTextFileSafely(outputPath, toPrettyJson(card), { overwrite: parsed.overwrite });
      outputs.push({ target: "character_card", path: outputPath, name: card.name, entry_count: card.data.character_book.entries.length });
    }
    return { ok: true, project_id: parsed.project_id, outputs };
  })));

  server.tool("query_json", QueryJsonInputSchema.shape, async (input) => toolText(await logToolCall("query_json", input, async () => {
    const parsed = QueryJsonInputSchema.parse(input);
    if (parsed.mode === "summary" || parsed.mode === "worldbook_entries" || parsed.mode === "greetings") return queryCharacterCard({ path: parsed.path, mode: parsed.mode });
    return queryWorldbook({ path: parsed.path, mode: parsed.mode, query: parsed.query, uid: parsed.uid });
  })));
}

function validateHydratedProject(project: Awaited<ReturnType<typeof loadProject>>, scope: "all" | "worldbook" | "character_card" | "mvu" | "html" | "ejs" | "style" | "chapter") {
  const result: Record<string, unknown> = { project_id: project.id };
  let ready = true;
  if (scope === "all" || scope === "worldbook") {
    const worldbook = confirmWorldbookDraftComplete(project.draft);
    result.worldbook = worldbook;
    ready &&= worldbook.ready_to_merge;
  }
  if ((scope === "all" || scope === "character_card") && project.characterCardConfig) {
    const characterCard = validateCharacterCardConfig({ config: project.characterCardConfig, draft: project.draft, mvuEnabled: project.mvuConfig?.enabled });
    result.character_card = characterCard;
    ready &&= characterCard.valid;
  }
  if ((scope === "all" || scope === "mvu") && project.mvuConfig) {
    const mvu = validateMvuConfig({ mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig });
    result.mvu = mvu;
    ready &&= mvu.valid;
  }
  if ((scope === "all" || scope === "html") && project.htmlBeautifyConfig) {
    const html = validateHtmlBeautifyConfig({ html: project.htmlBeautifyConfig, mvu: project.mvuConfig, characterCardConfig: project.characterCardConfig });
    result.html = html;
    ready &&= html.valid;
  }
  if ((scope === "all" || scope === "ejs") && project.ejsConfig) {
    const ejs = validateEjsConfig({ ejs: project.ejsConfig, mvu: project.mvuConfig });
    result.ejs = ejs;
    ready &&= ejs.valid;
  }
  return { ok: ready, ready_to_merge: ready, ...result };
}
