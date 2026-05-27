import { describe, expect, it } from "vitest";
import { buildHtmlBeautifyAssets } from "../src/core/html-beautify-assets.js";
import { createHtmlTemplate } from "../src/core/templates-v3.js";

describe("v3 HTML generated regex assets", () => {
  it("builds display and prompt scripts for statusbar", () => {
    const html = createHtmlTemplate();
    html.statusbar.html = "<div class=\"wbm-statusbar\"></div>";
    const result = buildHtmlBeautifyAssets(html);

    expect(result.regexScripts).toHaveLength(2);
    const display = result.regexScripts.find((script) => script.markdownOnly);
    const prompt = result.regexScripts.find((script) => script.promptOnly);
    expect(display?.replaceString).toContain("wbm-statusbar");
    expect(prompt?.replaceString).toBe("");
    expect(display?.findRegex).toBe(prompt?.findRegex);
  });

  it("can disable prompt hide regex generation", () => {
    const html = createHtmlTemplate();
    html.statusbar.html = "<div class=\"wbm-statusbar\"></div>";
    html.regexPolicy.generateHideRegex = false;
    const result = buildHtmlBeautifyAssets(html);

    expect(result.regexScripts).toHaveLength(1);
    expect(result.regexScripts[0].markdownOnly).toBe(true);
  });
});
