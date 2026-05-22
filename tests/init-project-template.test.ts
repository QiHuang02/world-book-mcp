import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureRootTemplateJson, findRootTavernJsonFiles } from "../src/storage/workspace-store.js";
import { ROOT_DIR } from "../src/storage/path-policy.js";

const tempFiles = [
  "初始化模板测试.json",
  "初始化模板测试.template.json",
  "初始化模板测试.template-2.json",
  "已有世界书.json",
  "已有角色卡.json",
  "普通配置.json",
];

async function cleanup(): Promise<void> {
  await Promise.all(tempFiles.map((file) => fs.rm(path.resolve(ROOT_DIR, file), { force: true })));
}

describe("init_project root template behavior", () => {
  it("creates workspace draft directory and a worldbook template when no Tavern JSON exists", async () => {
    await cleanup();
    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "worldbook" });

    expect(result.created).toBe(true);
    expect(result.reason).toBe("created");
    expect(result.path?.replace(/\\/g, "/")).toContain("/初始化模板测试.json");
    const json = JSON.parse(await fs.readFile(result.path!, "utf8"));
    expect(json.entries).toEqual({});
    await cleanup();
  });

  it("creates a character card template for character_card projects", async () => {
    await cleanup();
    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "character_card" });

    expect(result.created).toBe(true);
    const json = JSON.parse(await fs.readFile(result.path!, "utf8"));
    expect(json.spec).toBe("chara_card_v3");
    expect(json.data.character_book.entries).toEqual([]);
    await cleanup();
  });

  it("creates a character card with embedded worldbook template for mixed projects", async () => {
    await cleanup();
    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "mixed" });

    expect(result.created).toBe(true);
    const json = JSON.parse(await fs.readFile(result.path!, "utf8"));
    expect(json.spec).toBe("chara_card_v3");
    expect(json.data.character_book.name).toBe("初始化模板测试世界书");
    expect(json.data.character_book.entries).toEqual([]);
    await cleanup();
  });

  it("does not create a template when a root worldbook JSON exists", async () => {
    await cleanup();
    const existing = path.resolve(ROOT_DIR, "已有世界书.json");
    await fs.writeFile(existing, JSON.stringify({ name: "已有世界书", entries: {} }), "utf8");

    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "worldbook" });

    expect(result.created).toBe(false);
    expect(result.reason).toBe("existing_tavern_json");
    expect(result.existing_files?.map((file) => path.basename(file))).toContain("已有世界书.json");
    await expect(fs.access(path.resolve(ROOT_DIR, "初始化模板测试.json"))).rejects.toThrow();
    await cleanup();
  });

  it("does not create a template when a root character card JSON exists", async () => {
    await cleanup();
    const existing = path.resolve(ROOT_DIR, "已有角色卡.json");
    await fs.writeFile(existing, JSON.stringify({ spec: "chara_card_v3", data: { name: "已有角色卡", character_book: { entries: [] } } }), "utf8");

    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "worldbook" });

    expect(result.created).toBe(false);
    expect(result.existing_files?.map((file) => path.basename(file))).toContain("已有角色卡.json");
    await cleanup();
  });

  it("does not treat ordinary JSON as Tavern JSON and avoids overwriting it", async () => {
    await cleanup();
    const ordinary = path.resolve(ROOT_DIR, "初始化模板测试.json");
    await fs.writeFile(ordinary, JSON.stringify({ entries: { cache: true } }), "utf8");

    const result = await ensureRootTemplateJson({ name: "初始化模板测试", kind: "worldbook" });

    expect(result.created).toBe(true);
    expect(path.basename(result.path!)).toBe("初始化模板测试.template.json");
    expect(JSON.parse(await fs.readFile(ordinary, "utf8"))).toEqual({ entries: { cache: true } });
    const tavernFiles = await findRootTavernJsonFiles();
    expect(tavernFiles.map((file) => path.basename(file))).toContain("初始化模板测试.template.json");
    await cleanup();
  });
});
