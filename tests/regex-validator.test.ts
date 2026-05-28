import { describe, expect, it } from "vitest";
import { validateRegexScripts } from "../src/core/regex-validator.js";
import type { RegexScriptAsset } from "../src/core/mvu-assets.js";

function asset(overrides: Partial<RegexScriptAsset>): RegexScriptAsset {
  return {
    scriptName: "[界面]状态栏",
    findRegex: "/<StatusPlaceHolderImpl\\/>/gs",
    replaceString: "<div></div>",
    trimStrings: [],
    placement: [1, 2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
    ...overrides,
  };
}

describe("validateRegexScripts", () => {
  it("rejects scripts that set both markdownOnly and promptOnly", () => {
    const result = validateRegexScripts([asset({ markdownOnly: true, promptOnly: true })]);
    expect(result.ok).toBe(false);
  });

  it("warns when promptOnly replaceString is non empty", () => {
    const result = validateRegexScripts([asset({ markdownOnly: false, promptOnly: true, replaceString: "leak" })]);
    expect(result.warnings.some((issue) => issue.message.includes("空字符串"))).toBe(true);
  });

  it("warns when display rule lacks paired prompt rule", () => {
    const result = validateRegexScripts([asset({ markdownOnly: true })]);
    expect(result.warnings.some((issue) => issue.message.includes("缺少 promptOnly"))).toBe(true);
  });

  it("rejects cdata wrappers in replaceString", () => {
    const result = validateRegexScripts([asset({ replaceString: "<![CDATA[\n<div></div>\n]]>" })]);
    expect(result.errors.some((issue) => issue.code === "regex.replace.cdata")).toBe(true);
  });

  it("rejects bare stat_data macros in statusbar display regex", () => {
    const result = validateRegexScripts([asset({ replaceString: "<div class=\"wbm-statusbar\">{{stat_data.current_zone}}</div>" })]);
    expect(result.errors.some((issue) => issue.code === "regex.statusbar.bare_stat_data")).toBe(true);
  });
});
