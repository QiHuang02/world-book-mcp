import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonLike, readJsonFile, stringifyPrettyJson, writeJsonFile } from "../src/utils/json.js";
import { ROOT_DIR } from "../src/storage/path-policy.js";

describe("json utils", () => {
  it("stringifies pretty JSON with a trailing newline", () => {
    expect(stringifyPrettyJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });

  it("wraps parse errors with a readable message", () => {
    expect(() => parseJsonLike("{")).toThrow("JSON 解析失败");
  });

  it("reads and validates JSON files with zod schemas", async () => {
    const filePath = path.resolve(ROOT_DIR, "tmp-json-utils.json");
    await writeJsonFile(filePath, { name: "测试" });

    const parsed = await readJsonFile(filePath, z.object({ name: z.string() }));

    expect(parsed.name).toBe("测试");
    await fs.rm(filePath, { force: true });
  });
});
