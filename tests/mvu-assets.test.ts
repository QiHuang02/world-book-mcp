import { describe, expect, it } from "vitest";
import { buildMvuAssets } from "../src/core/mvu-assets.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("buildMvuAssets", () => {
  it("builds worldbook, regex and tavern helper assets", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const assets = buildMvuAssets(mvu);
    expect(assets.worldbookEntries.some((entry) => entry.comment.includes("initvar"))).toBe(true);
    expect(assets.worldbookEntries.some((entry) => entry.position === "at_depth" && entry.depth === 0)).toBe(true);
    expect(assets.regexScripts.some((script) => script.scriptName.includes("去除变量更新"))).toBe(true);
    expect(assets.tavernHelperScripts.some((script) => script.name === "变量结构")).toBe(true);
  });
});
