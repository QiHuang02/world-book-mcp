import fs from "node:fs/promises";
import type { z, ZodTypeAny } from "zod";

export function stringifyPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseJsonLike<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON 解析失败: ${message}`);
  }
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T>;
export async function readJsonFile<TSchema extends ZodTypeAny>(filePath: string, schema: TSchema): Promise<z.infer<TSchema>>;
export async function readJsonFile(filePath: string, schema?: ZodTypeAny): Promise<unknown> {
  const parsed = parseJsonLike(await fs.readFile(filePath, "utf8"));
  return schema ? schema.parse(parsed) : parsed;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, stringifyPrettyJson(value), "utf8");
}

export const toPrettyJson = stringifyPrettyJson;
export const safeJsonParse = parseJsonLike;
