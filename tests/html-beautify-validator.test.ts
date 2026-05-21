import { describe, expect, it } from "vitest";
import { createHtmlBeautifyTemplate } from "../src/core/html-beautify-template.js";
import { validateHtmlBeautifyConfig } from "../src/core/html-beautify-validator.js";

describe("validateHtmlBeautifyConfig", () => {
  it("accepts generated statusbar template", () => {
    const { html } = createHtmlBeautifyTemplate({ target: "statusbar", theme: "minimal" });
    const result = validateHtmlBeautifyConfig({ html, mvu: { enabled: true, style: "zod", schema_script: "registerMvuSchema", initvar: "a: 1", update_rules: "rules", variable_list_path: "stat_data", hide_regex: true, beautify_regex: true } });
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
});
