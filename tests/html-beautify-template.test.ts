import { describe, expect, it } from "vitest";
import { createHtmlBeautifyTemplate } from "../src/core/html-beautify-template.js";

describe("createHtmlBeautifyTemplate", () => {
  it("creates statusbar template", () => {
    const result = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    expect(result.html.statusbar.enabled).toBe(true);
    expect(result.html.statusbar.html).toContain("wbm-statusbar");
    expect(result.html.global.enabled).toBe(false);
  });
});
