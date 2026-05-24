import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { z, ZodTypeAny } from "zod";

function parseJsonLike<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON 解析失败: ${message}`);
  }
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T>;
export async function readJsonFile<TSchema extends ZodTypeAny>(filePath: string, schema: TSchema): Promise<z.infer<TSchema>>;
export async function readJsonFile(filePath: string, schema?: ZodTypeAny): Promise<unknown> {
  const parsed = parseJsonLike(await fs.readFile(filePath, "utf8"));
  return schema ? schema.parse(parsed) : parsed;
}

// 使用临时文件 + rename 实现原子写入；rename 在大多数文件系统上是原子的，
// 可以避免写一半被并发读到、或者跨进程同时写入导致内容串台/截断。
// 若同一进程内有多次并发写同一路径，依旧通过 fileWriteQueues 串行化（见 path-policy）。
export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tempName = `.${path.basename(resolved)}.tmp.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
  const tempPath = path.join(path.dirname(resolved), tempName);
  await fs.writeFile(tempPath, toPrettyJson(value), { encoding: "utf8", flag: "wx" });
  try {
    await fs.rename(tempPath, resolved);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}
