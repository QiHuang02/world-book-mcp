import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { z, ZodTypeAny } from "zod";

export function parseYaml<T = unknown>(text: string): T {
  try {
    return yaml.load(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`YAML 解析失败: ${message}`);
  }
}

export function stringifyYaml(value: unknown): string {
  return yaml.dump(value, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

export async function readYamlFile<T = unknown>(filePath: string): Promise<T>;
export async function readYamlFile<TSchema extends ZodTypeAny>(filePath: string, schema: TSchema): Promise<z.infer<TSchema>>;
export async function readYamlFile(filePath: string, schema?: ZodTypeAny): Promise<unknown> {
  const value = parseYaml(await fs.readFile(filePath, "utf8"));
  return schema ? schema.parse(value) : value;
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stringifyYaml(value), "utf8");
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
