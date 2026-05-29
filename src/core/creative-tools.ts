import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../schemas/project.js";
import { projectDir, readDraft, writeDraft } from "../storage/workspace.js";
import { resolveSourceFilePath } from "../storage/path-policy.js";
import { stringifyYaml, writeTextFile } from "../utils/yaml.js";
import { applyMvuPreset } from "./mvu-variables.js";

export interface EjsStageTemplateInput {
  controller_id?: string;
  variable: string;
  base_profile?: string;
  common_derivations?: string[];
  stages: Array<{ id: string; label: string; value: string; condition?: string; content?: string; exclusive_derivations?: string[]; rephrase_notes?: string[] }>;
  overwrite?: boolean;
}

export async function createEjsStageTemplate(project: Project, input: EjsStageTemplateInput): Promise<{ ok: boolean; project_id: string; files: string[]; controller_id: string }> {
  if ((await readDraft(project)).assets?.mvu.enabled !== true) await applyMvuPreset(project, { preset: "minimal", overwrite: false });
  const controllerId = input.controller_id ?? "stage-controller";
  const files: string[] = [];
  const controllerRel = `ejs/${safeSegment(controllerId)}.ejs`;
  const controllerPath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, controllerRel);
  const controllerContent = buildController(input.variable, input.stages);
  await writeTemplateFile(controllerPath, controllerContent, Boolean(input.overwrite));
  files.push(controllerPath);
  const stageEntries: Array<{ id: string; file: string; role: "stage"; enabled: boolean; position: "at_depth"; order: number; depth: number; conditionVariables: string[]; complexity: "entry_visibility" }> = [];
  for (const stage of input.stages) {
    const rel = `ejs/stage-${safeSegment(stage.id)}.ejs`;
    const filePath = resolveSourceFilePath(projectDir(project.slug), project.paths.sourceRoot, rel);
    const content = stage.content ?? `<stage_profile id="${escapeXml(stage.id)}">\n${stringifyYaml({ phase: stage.value, label: stage.label, condition: stage.condition ?? `${input.variable} == ${stage.value}`, base_profile: input.base_profile ?? "", common_derivations: input.common_derivations ?? [], exclusive_derivations: stage.exclusive_derivations ?? [], rephrase_notes: stage.rephrase_notes ?? [] })}</stage_profile>\n`;
    await writeTemplateFile(filePath, content, Boolean(input.overwrite));
    files.push(filePath);
    stageEntries.push({ id: `stage-${stage.id}`, file: `../source/${rel}`, role: "stage", enabled: false, position: "at_depth", order: 16010 + stageEntries.length, depth: 0, conditionVariables: [input.variable], complexity: "entry_visibility" });
  }
  const draft = await readDraft(project);
  await writeDraft(project, "assets", {
    ...(draft.assets ?? {}),
    mvu: { ...(draft.assets?.mvu ?? {}), enabled: true },
    ejs: {
      ...(draft.assets?.ejs ?? {}),
      enabled: true,
      entries: [
        ...((draft.assets?.ejs.entries ?? []).filter((entry) => entry.id !== controllerId && !stageEntries.some((stage) => stage.id === entry.id))),
        { id: controllerId, file: `../source/${controllerRel}`, role: "controller", enabled: true, position: "at_depth", order: 16000, depth: 0, conditionVariables: [input.variable], complexity: "dynamic_text" },
        ...stageEntries,
      ],
    },
  });
  return { ok: true, project_id: project.id, files, controller_id: controllerId };
}

async function writeTemplateFile(filePath: string, content: string, overwrite: boolean): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (overwrite) await writeTextFile(filePath, content);
  else await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
}

function buildController(variable: string, stages: EjsStageTemplateInput["stages"]): string {
  const lines = ["@@generate_before", `var phase = getvar('${variable}')`, "", "<%", "var stageEntry = '';"];
  for (const stage of stages) lines.push(`if (phase === ${JSON.stringify(stage.value)}) { stageEntry = ${JSON.stringify(`stage-${stage.id}`)}; }`);
  lines.push("if (stageEntry) {", "  await getwi(stageEntry);", "}", "%>", "");
  return lines.join("\n");
}

function safeSegment(value: string): string { return value.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "entry"; }
function escapeXml(value: string): string { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
