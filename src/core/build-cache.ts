import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { BuildManifest } from "../schemas/build-artifact.js";
import type { DraftSlice } from "../schemas/draft-slice.js";
import type { Project } from "../schemas/project.js";
import { buildRunDir, readBuildLatest, readBuildManifest, verifyFileHash, writeBuildArtifact } from "../storage/build-store.js";

export type CacheableBuildTarget = "mvu" | "html" | "regex" | "ejs" | "all" | "worldbook_preview" | "character_card_preview";

export interface BuildCacheContext {
  project: Project;
  target: "mvu" | "html" | "regex" | "ejs" | "all";
  strict_review: "off" | "standard" | "strict";
  include_previews: boolean;
  slices: DraftSlice[];
}

export interface BuildCacheReader {
  latest?: BuildManifest;
  diagnostics: { warnings: unknown[]; infos: unknown[] };
  reuseArtifact(input: { slug: string; buildId: string; target: CacheableBuildTarget; relativePath: string; fingerprint: string }): Promise<BuildManifest["artifacts"][number] | undefined>;
}

export async function createBuildCacheReader(slug: string, enabled: boolean): Promise<BuildCacheReader> {
  const diagnostics: BuildCacheReader["diagnostics"] = { warnings: [], infos: [] };
  if (!enabled) return { diagnostics, reuseArtifact: async () => undefined };
  const latestRef = await readBuildLatest(slug);
  if (!latestRef) return { diagnostics, reuseArtifact: async () => undefined };
  let latest: BuildManifest | undefined;
  try {
    latest = await readBuildManifest(slug, latestRef.build_id);
  } catch (error) {
    diagnostics.warnings.push({ code: "cache.latest_manifest_unreadable", build_id: latestRef.build_id, message: error instanceof Error ? error.message : String(error) });
    return { diagnostics, reuseArtifact: async () => undefined };
  }
  return {
    latest,
    diagnostics,
    reuseArtifact: async (input) => reuseArtifactFromLatest(latest, diagnostics, input),
  };
}

async function reuseArtifactFromLatest(latest: BuildManifest | undefined, diagnostics: BuildCacheReader["diagnostics"], input: { slug: string; buildId: string; target: CacheableBuildTarget; relativePath: string; fingerprint: string }): Promise<BuildManifest["artifacts"][number] | undefined> {
  const previous = latest?.artifacts.find((artifact) => artifact.target === input.target && artifact.cache?.fingerprint === input.fingerprint);
  if (!latest || !previous) return undefined;
  if (!await verifyFileHash(previous.path, previous.sha256)) {
    diagnostics.warnings.push({ code: "cache.artifact_hash_mismatch", build_id: latest.build_id, target: input.target, path: previous.path });
    return undefined;
  }
  const copied = await copyJsonArtifact(input.slug, input.buildId, input.relativePath, previous.path);
  diagnostics.infos.push({ code: "cache.artifact_reused", target: input.target, from_build_id: latest.build_id, from_path: previous.path, to_path: copied.path });
  return {
    ...previous,
    path: copied.path,
    sha256: copied.sha256,
    bytes: copied.bytes,
    created_at: new Date().toISOString(),
    cache: { fingerprint: input.fingerprint, reused_from_build_id: latest.build_id, reused_from_path: previous.path },
    stale: false,
  };
}

async function copyJsonArtifact(slug: string, buildId: string, relativePath: string, sourcePath: string): Promise<{ path: string; sha256: string; bytes: number }> {
  const targetPath = path.resolve(buildRunDir(slug, buildId), relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  const buffer = await fs.readFile(targetPath);
  return { path: targetPath, sha256: sha256Buffer(buffer), bytes: buffer.length };
}

export function targetFingerprint(context: BuildCacheContext, target: CacheableBuildTarget): string {
  const relatedSlices = relevantSlices(context.slices, target).map((slice) => ({ id: slice.id, type: slice.type, active: slice.active, revision: slice.revision, updatedAt: slice.updatedAt }));
  const projectInput = projectFingerprintInput(context.project, target);
  return sha256Json({
    cache_version: 1,
    target,
    requested_target: context.target,
    include_previews: context.include_previews,
    strict_review: context.strict_review,
    project: projectInput,
    slices: relatedSlices,
  });
}

function relevantSlices(slices: DraftSlice[], target: CacheableBuildTarget): DraftSlice[] {
  const active = slices.filter((slice) => slice.active);
  switch (target) {
    case "mvu": return active.filter((slice) => slice.type === "mvu");
    case "html": return active.filter((slice) => slice.type === "html");
    case "regex": return active.filter((slice) => slice.type === "mvu" || slice.type === "html" || slice.type === "regex");
    case "ejs": return active.filter((slice) => slice.type === "ejs");
    case "all": return active.filter((slice) => slice.type === "mvu" || slice.type === "html" || slice.type === "regex" || slice.type === "ejs");
    case "worldbook_preview": return active.filter((slice) => slice.type === "entry" || slice.type === "mvu" || slice.type === "html" || slice.type === "ejs");
    case "character_card_preview": return active;
  }
}

function projectFingerprintInput(project: Project, target: CacheableBuildTarget): unknown {
  const base = { id: project.id, name: project.name, kind: project.kind, plan: project.plan };
  if (target === "character_card_preview") return { ...base, opening: project.opening, profile: project.profile, greetings: project.greetings };
  if (target === "worldbook_preview") return { ...base, output: project.kind.output };
  return base;
}

export function artifactCache(fingerprint: string): { fingerprint: string } {
  return { fingerprint };
}

function sha256Json(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
  }
  return value;
}
