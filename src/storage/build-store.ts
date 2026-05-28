import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { BuildLatestSchema, BuildManifestSchema, ExportRecordSchema, type BuildLatest, type BuildManifest, type ExportRecord } from "../schemas/build-artifact.js";
import { toPrettyJson } from "../utils/json.js";
import { readYamlFile, toPrettyYaml, writeYamlFile } from "../utils/yaml.js";
import { assertInside } from "./path-policy.js";
import { projectBuildDir } from "./workspace-store.js";

export function createBuildId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").replace(/-000Z$/, "Z");
  return `build_${stamp}_${crypto.randomBytes(3).toString("hex")}`;
}

export function createExportId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").replace(/-000Z$/, "Z");
  return `export_${stamp}_${crypto.randomBytes(3).toString("hex")}`;
}

export function buildRunDir(slug: string, buildId: string): string { return assertInside(path.resolve(projectBuildDir(slug), "runs"), path.resolve(projectBuildDir(slug), "runs", buildId)); }
export function buildManifestPath(slug: string, buildId: string): string { return path.resolve(buildRunDir(slug, buildId), "manifest.yaml"); }
export function buildLatestPath(slug: string): string { return path.resolve(projectBuildDir(slug), "latest.yaml"); }
export function buildAssetsDir(slug: string, buildId: string): string { return path.resolve(buildRunDir(slug, buildId), "assets"); }
export function buildExportsDir(slug: string, buildId: string): string { return path.resolve(buildRunDir(slug, buildId), "exports"); }
export function buildExportRecordsDir(slug: string, buildId: string): string { return path.resolve(buildRunDir(slug, buildId), "export-records"); }

export async function ensureBuildRunDirs(slug: string, buildId: string): Promise<void> {
  await Promise.all([fs.mkdir(buildAssetsDir(slug, buildId), { recursive: true }), fs.mkdir(buildExportsDir(slug, buildId), { recursive: true }), fs.mkdir(buildExportRecordsDir(slug, buildId), { recursive: true })]);
}

export async function writeBuildArtifact(slug: string, buildId: string, relativePath: string, value: unknown): Promise<{ path: string; sha256: string; bytes: number }> {
  await ensureBuildRunDirs(slug, buildId);
  const filePath = assertInside(buildRunDir(slug, buildId), path.resolve(buildRunDir(slug, buildId), relativePath));
  const content = relativePath.endsWith(".json") ? toPrettyJson(value) : toPrettyYaml(value);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return { path: filePath, sha256: sha256Text(content), bytes: Buffer.byteLength(content, "utf8") };
}

export async function writeBuildManifest(slug: string, manifest: BuildManifest): Promise<string> {
  await ensureBuildRunDirs(slug, manifest.build_id);
  const parsed = BuildManifestSchema.parse(manifest);
  const filePath = buildManifestPath(slug, manifest.build_id);
  await writeYamlFile(filePath, parsed);
  return filePath;
}

export async function readBuildManifest(slug: string, buildId: string): Promise<BuildManifest> { return readYamlFile(buildManifestPath(slug, buildId), BuildManifestSchema); }

export async function writeBuildLatest(slug: string, manifest: BuildManifest, manifestPath: string): Promise<void> {
  const latest: BuildLatest = BuildLatestSchema.parse({ build_id: manifest.build_id, manifest_path: manifestPath, built_at: manifest.built_at, status: manifest.status });
  await writeYamlFile(buildLatestPath(slug), latest);
}

export async function readBuildLatest(slug: string): Promise<BuildLatest | undefined> {
  try { return await readYamlFile(buildLatestPath(slug), BuildLatestSchema); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

export async function writeExportRecord(slug: string, buildId: string, record: ExportRecord): Promise<string> {
  const parsed = ExportRecordSchema.parse(record);
  const filePath = path.resolve(buildExportRecordsDir(slug, buildId), `${parsed.export_id}.yaml`);
  await writeYamlFile(filePath, parsed);
  return filePath;
}

export async function fileSnapshot(filePath: string, revision?: number): Promise<{ path: string; revision?: number; sha256: string; bytes: number; updated_at?: string }> {
  const buffer = await fs.readFile(filePath);
  const stat = await fs.stat(filePath);
  return { path: filePath, revision, sha256: sha256Buffer(buffer), bytes: buffer.length, updated_at: stat.mtime.toISOString() };
}

export async function verifyFileHash(filePath: string, expected: string): Promise<boolean> {
  try { return sha256Buffer(await fs.readFile(filePath)) === expected; }
  catch { return false; }
}

export function sha256Text(text: string): string { return crypto.createHash("sha256").update(text).digest("hex"); }
export function sha256Buffer(buffer: Buffer): string { return crypto.createHash("sha256").update(buffer).digest("hex"); }
