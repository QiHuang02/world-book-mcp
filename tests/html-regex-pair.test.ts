import { describe, expect, it } from "vitest";
import { createHtmlRegexPairTemplate } from "../src/core/html-regex-pair.js";

describe("createHtmlRegexPairTemplate", () => {
  it("builds display + prompt pair for statusbar", () => {
    const result = createHtmlRegexPairTemplate({ scope: "statusbar", display_html: "<div class=\"wbm-statusbar\"></div>" });
    expect(result.scripts).toHaveLength(2);
    const display = result.scripts.find((script) => script.markdownOnly);
    const prompt = result.scripts.find((script) => script.promptOnly);
    expect(display?.replaceString).toContain("wbm-statusbar");
    expect(prompt?.replaceString).toBe("");
    expect(display?.findRegex).toBe(prompt?.findRegex);
  });

  it("keeps $1 placeholder for global hide regex", () => {
    const result = createHtmlRegexPairTemplate({ scope: "global", display_html: "<div>$1<StatusPlaceHolderImpl/></div>" });
    const prompt = result.scripts.find((script) => script.promptOnly);
    expect(prompt?.replaceString).toBe("$1");
  });
});
