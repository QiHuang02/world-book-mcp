import fs from "node:fs/promises";
import path from "node:path";
import { assertInside, ROOT_DIR } from "./path-policy.js";

const PLAN_WORKSPACE_DIR = path.resolve(ROOT_DIR, ".worldbook");
export const PLAN_PATH = assertInside(PLAN_WORKSPACE_DIR, path.resolve(PLAN_WORKSPACE_DIR, "plan.md"));

export const DEFAULT_PLAN = `# World Book MCP Plan

## 1. 用户原始需求

## 2. 任务类型与输出目标

## 3. 已导入资产

## 4. 用户决策记录

| 问题 | 用户回答 | 说明 |
|---|---|---|

## 5. 世界观设定

## 6. 角色设定

## 7. 事件 / 场景 / 地点

## 8. 物品 / 能力 / 装备

## 9. MVU 设计

## 10. HTML 美化设计

## 11. EJS 动态内容设计

## 12. 文风要求

## 13. Draft 切片计划

## 14. 校验计划

## 15. 导出计划
`;

export async function ensurePlanFile(): Promise<string> {
  await fs.mkdir(path.dirname(PLAN_PATH), { recursive: true });
  try {
    await fs.writeFile(PLAN_PATH, DEFAULT_PLAN, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return PLAN_PATH;
}

export async function readPlan(): Promise<string> {
  await ensurePlanFile();
  return fs.readFile(PLAN_PATH, "utf8");
}

export async function writePlan(content: string): Promise<string> {
  return enqueuePlanWrite(async () => {
    await fs.mkdir(path.dirname(PLAN_PATH), { recursive: true });
    await fs.writeFile(PLAN_PATH, content, "utf8");
    return PLAN_PATH;
  });
}

export async function replacePlanSection(section: string, content: string): Promise<string> {
  return enqueuePlanWrite(async () => updatePlanSection(section, () => `\n${content.trim()}\n\n`));
}

export async function appendPlanNote(section: string, content: string): Promise<string> {
  return enqueuePlanWrite(async () => updatePlanSection(section, (body) => `${body.trimEnd()}\n\n${content.trim()}\n\n`));
}

export async function appendDecision(input: { question: string; answer: string; rationale?: string }): Promise<string> {
  const row = `| ${escapeTable(input.question)} | ${escapeTable(input.answer)} | ${escapeTable(input.rationale ?? "")} |`;
  return enqueuePlanWrite(async () => updatePlanSection("4. 用户决策记录", (body) => `${body.trimEnd()}\n\n${row.trim()}\n\n`));
}

let planQueueTail: Promise<unknown> = Promise.resolve();

function enqueuePlanWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = planQueueTail.catch(() => undefined).then(operation);
  planQueueTail = next;
  return next;
}

async function updatePlanSection(section: string, updater: (body: string) => string): Promise<string> {
  const plan = await readPlan();
  const heading = normalizeHeading(section);
  const pattern = sectionPattern(heading);
  const newContent = !pattern.test(plan)
    ? `${plan.trimEnd()}\n\n${heading}\n\n${updater("").trim()}\n`
    : plan.replace(pattern, (_match, head, body) => `${head}${updater(body)}`);
  await fs.mkdir(path.dirname(PLAN_PATH), { recursive: true });
  await fs.writeFile(PLAN_PATH, newContent, "utf8");
  return PLAN_PATH;
}

function normalizeHeading(section: string): string {
  return section.startsWith("## ") ? section : `## ${section}`;
}

function sectionPattern(heading: string): RegExp {
  return new RegExp(`(^${escapeRegExp(heading)}\\n)([\\s\\S]*?)(?=^## |\\s*$)`, "m");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeTable(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}
