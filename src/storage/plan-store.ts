import fs from "node:fs/promises";
import path from "node:path";
import type { PlanItem, PlanItemStatus } from "../schemas/plan.js";
import { projectPlanPath } from "./workspace-store.js";

const DEFAULT_PLAN = `# World Book MCP Plan

## 0. Plan Metadata

- Goal: 未记录
- Scope: 未记录
- Non-goals: 未记录
- Assumptions: 未记录

## 1. 用户原始需求

## 2. Project.kind

## 3. output / source / assets

## 4. opening 设计

## 5. 用户决策记录

| 问题 | 用户回答 | 说明 |
|---|---|---|

## 6. Scope / Slice Map / Asset Map

## 7. Implementation Tasks

## 8. Acceptance Criteria

## 9. Verification Plan

## 10. Risks / Blockers / Open Questions

## 11. Build / Delivery 计划

## 12. 内容规则自查记录

## 13. 导出计划
`;

export function planPath(slug: string): string { return projectPlanPath(slug); }

export async function ensurePlanFile(slug: string): Promise<string> {
  const filePath = planPath(slug);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try { await fs.writeFile(filePath, DEFAULT_PLAN, { encoding: "utf8", flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  return filePath;
}

export async function readPlan(slug: string): Promise<string> { await ensurePlanFile(slug); return fs.readFile(planPath(slug), "utf8"); }
export async function writePlan(slug: string, content: string): Promise<string> { return enqueuePlanWrite(slug, async () => { const filePath = planPath(slug); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, content, "utf8"); return filePath; }); }
export async function replacePlanSection(slug: string, section: string, content: string): Promise<string> { return enqueuePlanWrite(slug, async () => updatePlanSection(slug, section, () => `\n${content.trim()}\n\n`)); }
export async function appendPlanNote(slug: string, section: string, content: string): Promise<string> { return enqueuePlanWrite(slug, async () => updatePlanSection(slug, section, (body) => `${body.trimEnd()}\n\n${content.trim()}\n\n`)); }
export async function appendDecision(slug: string, input: { question: string; answer: string; rationale?: string }): Promise<string> {
  const row = `| ${escapeTable(input.question)} | ${escapeTable(input.answer)} | ${escapeTable(input.rationale ?? "")} |`;
  return enqueuePlanWrite(slug, async () => updatePlanSection(slug, "5. 用户决策记录", (body) => `${body.trimEnd()}\n\n${row.trim()}\n\n`));
}

export async function upsertPlanItemNote(slug: string, item: PlanItem): Promise<string> {
  return enqueuePlanWrite(slug, async () => updatePlanSection(slug, "7. Implementation Tasks", (body) => {
    const lines = body.split(/\r?\n/);
    const start = lines.findIndex((line) => line.includes(`<!-- plan-item:${item.id} -->`));
    if (start >= 0) {
      let end = start + 1;
      while (end < lines.length && /^  - /.test(lines[end])) end++;
      lines.splice(start, end - start);
    }
    lines.push(renderPlanItem(item));
    return `\n${lines.join("\n").trim()}\n\n`;
  }));
}

export async function updatePlanItemStatusNote(slug: string, id: string, status: PlanItemStatus): Promise<string> {
  return enqueuePlanWrite(slug, async () => updatePlanSection(slug, "7. Implementation Tasks", (body) => {
    const pattern = new RegExp(`^- \\[[ x!-]\\] ${escapeRegExp(id)}:`, "m");
    const marker = `<!-- plan-item:${id} -->`;
    const checkbox = status === "done" ? "x" : status === "blocked" ? "!" : status === "skipped" ? "-" : " ";
    const updated = body.split(/\r?\n/).map((line) => line.includes(marker) ? line.replace(/\[[ x!-]\]/, `[${checkbox}]`) : line);
    if (!updated.some((line) => line.includes(marker)) && pattern.test(body)) return `\n${body.replace(pattern, `- [${checkbox}] ${id}:`)}\n\n`;
    return `\n${updated.join("\n").trim()}\n\n`;
  }));
}

export async function appendAcceptanceCriterion(slug: string, text: string): Promise<string> { return appendBullet(slug, "8. Acceptance Criteria", text); }
export async function appendVerificationStep(slug: string, text: string): Promise<string> { return appendBullet(slug, "9. Verification Plan", text); }
export async function appendRisk(slug: string, text: string): Promise<string> { return appendBullet(slug, "10. Risks / Blockers / Open Questions", text); }
export async function appendCheckpoint(slug: string, text: string): Promise<string> { return appendBullet(slug, "11. Build / Delivery 计划", `[Checkpoint] ${text}`); }

async function appendBullet(slug: string, section: string, text: string): Promise<string> {
  return enqueuePlanWrite(slug, async () => updatePlanSection(slug, section, (body) => `${body.trimEnd()}\n- ${text.trim()}\n\n`));
}

function renderPlanItem(item: PlanItem): string {
  const checkbox = item.status === "done" ? "x" : item.status === "blocked" ? "!" : item.status === "skipped" ? "-" : " ";
  const target = item.target ? [`draft=${item.target.draftType ?? ""}`, `slice=${item.target.sliceId ?? ""}`, `tool=${item.target.tool ?? ""}`].filter((part) => !part.endsWith("=")).join(", ") : "";
  const parts = [`- [${checkbox}] ${item.id}: ${item.title} <!-- plan-item:${item.id} -->`, `  - category: ${item.category}`, `  - status: ${item.status}`];
  if (item.description) parts.push(`  - description: ${item.description}`);
  if (target) parts.push(`  - target: ${target}`);
  if (item.dependsOn.length) parts.push(`  - dependsOn: ${item.dependsOn.join(", ")}`);
  for (const criterion of item.acceptance) parts.push(`  - acceptance: ${criterion}`);
  for (const step of item.verification) parts.push(`  - verification: ${step}`);
  for (const risk of item.risks) parts.push(`  - risk: ${risk}`);
  return parts.join("\n");
}

const planQueueTails = new Map<string, Promise<unknown>>();
function enqueuePlanWrite<T>(slug: string, operation: () => Promise<T>): Promise<T> { const previous = planQueueTails.get(slug) ?? Promise.resolve(); const next = previous.catch(() => undefined).then(operation); planQueueTails.set(slug, next.finally(() => { if (planQueueTails.get(slug) === next) planQueueTails.delete(slug); })); return next; }

async function updatePlanSection(slug: string, section: string, updater: (body: string) => string): Promise<string> {
  const plan = await readPlan(slug);
  const heading = normalizeHeading(section);
  const pattern = sectionPattern(heading);
  const filePath = planPath(slug);
  const newContent = !pattern.test(plan) ? `${plan.trimEnd()}\n\n${heading}\n\n${updater("").trim()}\n` : plan.replace(pattern, (_match, head, body) => `${head}${updater(body)}`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, newContent, "utf8");
  return filePath;
}
function normalizeHeading(section: string): string { return section.startsWith("## ") ? section : `## ${section}`; }
function sectionPattern(heading: string): RegExp { return new RegExp(`(^${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeTable(value: string): string { return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\|/g, "\\|").replace(/\n/g, "<br>"); }
