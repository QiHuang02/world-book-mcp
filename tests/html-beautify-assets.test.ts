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

  it("normalizes cdata and bare stat_data macros in generated statusbar regex", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const assets = buildHtmlBeautifyAssets({ ...html, statusbar: { ...html.statusbar, html: "<![CDATA[\n<div class='wbm-statusbar'>{{stat_data.current_zone}}</div>\n]]>" } });
    const display = assets.regexScripts.find((script) => script.scriptName.includes("状态栏"));
    expect(display?.replaceString).not.toContain("CDATA");
    expect(display?.replaceString).not.toContain("{{stat_data");
    expect(display?.replaceString).toContain("{{format_message_variable::stat_data.current_zone}}");
  });
});
