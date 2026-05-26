import type { HtmlRegexScriptConfig } from "../schemas/html-beautify.js";

export function createHtmlRegexPairTemplate(input: { scope: "statusbar" | "global"; display_html: string }): { scripts: HtmlRegexScriptConfig[] } {
  const findRegex = input.scope === "global" ? "([\\s\\S]*?)<StatusPlaceHolderImpl\\/>" : "<StatusPlaceHolderImpl\\/>";
  return {
    scripts: [
      {
        name: `${input.scope} display`,
        findRegex,
        replaceString: input.display_html,
        markdownOnly: true,
        promptOnly: false,
        placement: [2],
        runOnEdit: true,
      },
      {
        name: `${input.scope} prompt hide`,
        findRegex,
        replaceString: input.scope === "global" ? "$1" : "",
        markdownOnly: false,
        promptOnly: true,
        placement: [2],
        runOnEdit: true,
      },
    ],
  };
}
