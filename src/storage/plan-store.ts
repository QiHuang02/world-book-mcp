import fs from "node:fs/promises";
import path from "node:path";
import { projectPlanPath } from "./workspace-store.js";

const DEFAULT_PLAN = `# World Book MCP Plan

## 1. 用户原始需求

## 2. Project.kind

## 3. output / source / assets

## 4. opening 设计

## 5. 用户决策记录

| 问题 | 用户回答 | 说明 |
|---|---|---|

## 6. Draft Slice 计划

## 7. MVU / HTML / regex / EJS 资产计划

## 8. Build / Delivery 计划

## 9. 内容规则自查记录

## 10. 导出计划
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
function sectionPattern(heading: string): RegExp { return new RegExp(`(^${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=^## |\\s*$)`, "m"); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeTable(value: string): string { return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\|/g, "\\|").replace(/\n/g, "<br>"); }
