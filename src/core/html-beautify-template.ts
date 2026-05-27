import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";

export function createDefaultHtmlBeautifyConfig(): HtmlBeautifyConfig {
  return { target: "statusbar", theme: "minimal", statusbar: { html: "", hideRegex: true }, regexPolicy: { generateHideRegex: true, generateStatusbarRegex: true }, variablePaths: [] };
}
