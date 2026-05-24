import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCharacterCardOutputPath, resolveWorldbookOutputPath } from "../src/tools/export-tools.js";
import { ROOT_DIR } from "../src/storage/path-policy.js";

describe("export tools output path resolution", () => {
  it("uses the imported worldbook path when no explicit output path is provided", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板世界书.json");

    const outputPath = resolveWorldbookOutputPath({ importedPath, fallbackName: "合并后的世界书" });

    expect(outputPath).toBe(importedPath);
  });

  it("uses the imported character card path when no explicit output path is provided", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板角色卡.json");

    const outputPath = resolveCharacterCardOutputPath({ importedPath, fallbackName: "合并后的角色卡" });

    expect(outputPath).toBe(importedPath);
  });

  it("lets an explicit output path override the imported template path", () => {
    const importedPath = path.resolve(ROOT_DIR, "模板世界书.json");

    const outputPath = resolveWorldbookOutputPath({ explicitPath: "另存为.json", importedPath, fallbackName: "合并后的世界书" });

    expect(outputPath).toBe(path.resolve(ROOT_DIR, "另存为.json"));
  });
});
