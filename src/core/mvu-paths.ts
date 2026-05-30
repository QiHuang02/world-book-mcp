export type MvuPathFormat = "ejs" | "json_patch" | "yaml_dot";

export interface ConvertMvuPathInput {
  path: string;
  from?: MvuPathFormat | "auto";
  to: MvuPathFormat;
}

export interface ConvertMvuPathResult {
  input: string;
  from: MvuPathFormat;
  to: MvuPathFormat;
  path: string;
  segments: string[];
}

export function convertMvuPath(input: ConvertMvuPathInput): ConvertMvuPathResult {
  const from = input.from && input.from !== "auto" ? input.from : detectMvuPathFormat(input.path);
  const segments = parseMvuPath(input.path, from);
  return { input: input.path, from, to: input.to, path: formatMvuPath(segments, input.to), segments };
}

export function detectMvuPathFormat(value: string): MvuPathFormat {
  if (value.startsWith("/")) return "json_patch";
  if (value.startsWith("stat_data.") || value === "stat_data") return "ejs";
  return "yaml_dot";
}

export function parseMvuPath(value: string, format: MvuPathFormat): string[] {
  if (!value.trim()) throw new Error("MVU 路径不能为空");
  if (format === "json_patch") {
    return value
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map(unescapeJsonPointerSegment);
  }
  const normalized = format === "ejs" ? value.replace(/^stat_data\.?/, "") : value;
  return normalized.split(".").map((segment) => segment.trim()).filter(Boolean);
}

export function formatMvuPath(segments: string[], format: MvuPathFormat): string {
  if (segments.length === 0) throw new Error("MVU 路径至少需要一个片段");
  if (format === "json_patch") return `/${segments.map(escapeJsonPointerSegment).join("/")}`;
  if (format === "ejs") return `stat_data.${segments.join(".")}`;
  return segments.join(".");
}

function escapeJsonPointerSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapeJsonPointerSegment(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~");
}
