import fs from "node:fs/promises";
import path from "node:path";
import { createExportId, writeExportRecord, sha256Buffer } from "../storage/build-store.js";
import { assertSafeOutputPath, backupIfOverwriteTarget } from "../storage/path-policy.js";
import { buildExportsDir } from "../storage/build-store.js";
import type { BuildManifest, ExportRecord } from "../schemas/build-artifact.js";
import type { Project } from "../schemas/project.js";

export async function exportFromBuild(input: { project: Project; slug: string; manifest: BuildManifest; target: "worldbook" | "character_card" | "both"; output_path?: string; output_paths?: { worldbook?: string; character_card?: string }; overwrite?: boolean; forced?: boolean; stale?: boolean; stale_reasons?: string[] }): Promise<{ export_record: ExportRecord; export_record_path: string }> {
  const targets = input.target === "both" ? ["worldbook", "character_card"] as const : [input.target] as const;
  const outputs: ExportRecord["outputs"] = [];
  for (const target of targets) {
    const preview = path.resolve(buildExportsDir(input.slug, input.manifest.build_id), target === "worldbook" ? "worldbook.preview.json" : "character_card.preview.json");
    await fs.access(preview);
    const final = assertSafeOutputPath(input.output_paths?.[target] ?? (targets.length === 1 ? input.output_path : undefined) ?? defaultOutputPath(input.project, target), { overwrite: Boolean(input.overwrite) });
    const backup = input.overwrite ? await backupIfOverwriteTarget(final, input.slug) : undefined;
    await fs.copyFile(preview, final);
    const buffer = await fs.readFile(final);
    outputs.push({ target, preview_path: preview, final_path: final, sha256: sha256Buffer(buffer), bytes: buffer.length, overwrite: Boolean(input.overwrite), backup_path: backup });
  }
  const export_id = createExportId();
  const record: ExportRecord = { schema_version: 2, export_id, exported_at: new Date().toISOString(), project_id: input.project.id, build_id: input.manifest.build_id, target: input.target, forced: Boolean(input.forced), stale_at_export: Boolean(input.stale), stale_reasons: input.stale_reasons ?? [], outputs, delivery: { ready_to_export: input.manifest.delivery.ready_to_export, blocking_count: input.manifest.delivery.blocking_count, warning_count: input.manifest.delivery.warning_count, checklist_path: input.manifest.delivery.checklist_path } };
  return { export_record: record, export_record_path: await writeExportRecord(input.slug, input.manifest.build_id, record) };
}
function defaultOutputPath(project: Project, target: "worldbook" | "character_card"): string { const safe = project.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_"); return target === "worldbook" ? `${safe}.worldbook.json` : `${safe}.card.json`; }
