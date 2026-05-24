import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { nowIso } from "../utils/ids.js";
import { assertInside, ROOT_DIR } from "./path-policy.js";

export const LOG_DIR = assertInside(path.resolve(ROOT_DIR, ".worldbook"), path.resolve(ROOT_DIR, ".worldbook", "logs"));
export const LATEST_LOG_PATH = assertInside(LOG_DIR, path.resolve(LOG_DIR, "latest.jsonl"));

let sessionId = `session_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

export function currentSessionId(): string {
  return sessionId;
}

export function resetToolLogSession(id?: string): string {
  sessionId = id ?? `session_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  return sessionId;
}

export function sessionLogPath(id = sessionId): string {
  return assertInside(LOG_DIR, path.resolve(LOG_DIR, `${id}.jsonl`));
}

export async function ensureLogDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await ensureLatestLogTruncated();
}

// 跨进程并发写 latest.jsonl 没有原子保护，且文件会无界增长。
// 折中方案：每次 server 启动时把 latest.jsonl 截断一次，让它只承载"当前会话开始之后"的事件；
// 历史日志通过 sessionLogPath() 的 session_<id>.jsonl 文件保留。
let latestLogTruncated: Promise<void> | undefined;
function ensureLatestLogTruncated(): Promise<void> {
  if (!latestLogTruncated) {
    latestLogTruncated = fs.writeFile(LATEST_LOG_PATH, "", "utf8").catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await fs.mkdir(LOG_DIR, { recursive: true });
        await fs.writeFile(LATEST_LOG_PATH, "", "utf8");
        return;
      }
      throw error;
    });
  }
  return latestLogTruncated;
}

export async function appendToolLog(event: {
  project_id?: string;
  tool: string;
  request?: unknown;
  response?: unknown;
  error?: unknown;
}): Promise<void> {
  await ensureLogDir();
  const line = `${JSON.stringify({
    timestamp: nowIso(),
    session_id: sessionId,
    project_id: event.project_id,
    tool: event.tool,
    request_summary: summarizeValue(event.request),
    response_summary: summarizeValue(event.response),
    error: event.error ? summarizeError(event.error) : null,
  })}\n`;
  await Promise.all([
    fs.appendFile(LATEST_LOG_PATH, line, "utf8"),
    fs.appendFile(sessionLogPath(), line, "utf8"),
  ]);
}

export async function logToolCall<T>(tool: string, request: unknown, handler: () => Promise<T>): Promise<T> {
  const project_id = typeof request === "object" && request ? (request as Record<string, unknown>).project_id as string | undefined : undefined;
  try {
    const response = await handler();
    await appendToolLog({ project_id, tool, request, response });
    return response;
  } catch (error) {
    await appendToolLog({ project_id, tool, request, error });
    throw error;
  }
}

function summarizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (depth > 5) return "[truncated-depth]";
  if (typeof value === "string") return summarizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
  }
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, preview: value.slice(0, 5).map((item) => summarizeValue(item, depth + 1, seen)) };
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record).slice(0, 30)) {
      summary[key] = summarizeValue(item, depth + 1, seen);
    }
    return summary;
  }
  return String(value);
}

function summarizeString(value: string): unknown {
  if (value.length <= 240) return value;
  return {
    type: "string",
    chars: value.length,
    sha256: crypto.createHash("sha256").update(value).digest("hex"),
    preview: value.slice(0, 240),
  };
}

function summarizeError(error: unknown): unknown {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return summarizeValue(error);
}
