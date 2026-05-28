import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { z, ZodTypeAny } from "zod";

export function parseYamlLike<T = unknown>(text: string): T {
  try {
    return yaml.load(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`YAML 解析失败: ${message}`);
  }
}

export function toPrettyYaml(value: unknown): string {
  return yaml.dump(sortPlainObject(value), {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

export async function readYamlFile<T = unknown>(filePath: string): Promise<T>;
export async function readYamlFile<TSchema extends ZodTypeAny>(filePath: string, schema: TSchema): Promise<z.infer<TSchema>>;
export async function readYamlFile(filePath: string, schema?: ZodTypeAny): Promise<unknown> {
  const parsed = parseYamlLike(await fs.readFile(filePath, "utf8"));
  return schema ? schema.parse(parsed) : parsed;
}

const yamlWriteQueues = new Map<string, Promise<unknown>>();

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  const resolved = path.resolve(filePath);
  const previous = yamlWriteQueues.get(resolved) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeYamlFileNow(resolved, value));
  yamlWriteQueues.set(resolved, next.finally(() => { if (yamlWriteQueues.get(resolved) === next) yamlWriteQueues.delete(resolved); }));
  return next;
}

async function writeYamlFileNow(resolved: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tempName = `.${path.basename(resolved)}.tmp.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
  const tempPath = path.join(path.dirname(resolved), tempName);
  await fs.writeFile(tempPath, toPrettyYaml(value), { encoding: "utf8", flag: "wx" });
  try {
    await fs.rename(tempPath, resolved);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export function sortPlainObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortPlainObject);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortPlainObject(item)]));
  }
  return value;
}
