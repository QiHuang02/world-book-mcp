import { describe, expect, it } from "vitest";
import { createHtmlBeautifyTemplate } from "../src/core/html-beautify-template.js";
import { validateHtmlBeautifyConfig } from "../src/core/html-beautify-validator.js";

const mvu = {
  schemaScript: "export const Schema = z.object({});\nregisterMvuSchema(Schema);",
  variableListPath: "stat_data",
  hideRegex: true,
  beautifyRegex: true,
};

describe("validateHtmlBeautifyConfig", () => {
  it("accepts generated statusbar template", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html, mvu });
    expect(result.valid).toBe(true);
  });

  it("rejects empty statusbar html", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html: { ...html, statusbar: { ...html.statusbar, html: "" } } });
    expect(result.valid).toBe(false);
  });

  it("warns about script tags", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html: { ...html, statusbar: { ...html.statusbar, html: "<script>alert(1)</script><div class='wbm-statusbar'></div>" } } });
    expect(result.warnings.some((issue) => issue.field === "statusbar.html")).toBe(true);
  });

  it("rejects cdata in statusbar html", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html: { ...html, statusbar: { ...html.statusbar, html: "<![CDATA[<div class='wbm-statusbar'></div>]]>" } } });
    expect(result.errors.some((issue) => issue.code === "html.statusbar.cdata")).toBe(true);
  });

  it("rejects bare stat_data macros in statusbar html", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html: { ...html, statusbar: { ...html.statusbar, html: "<div class='wbm-statusbar'>{{stat_data.current_zone}}</div>" } } });
    expect(result.errors.some((issue) => issue.code === "html.statusbar.bare_stat_data")).toBe(true);
  });
});
