import { describe, expect, it } from "vitest";
import { buildHtmlBeautifyAssets } from "../src/core/html-beautify-assets.js";
import { createHtmlBeautifyTemplate } from "../src/core/html-beautify-template.js";

describe("buildHtmlBeautifyAssets", () => {
  it("builds statusbar regex scripts", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const assets = buildHtmlBeautifyAssets(html);
    expect(assets.regexScripts.some((script) => script.scriptName.includes("状态栏"))).toBe(true);
    expect(assets.regexScripts.some((script) => script.promptOnly)).toBe(true);
  });
});
