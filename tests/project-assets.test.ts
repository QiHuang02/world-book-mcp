import { describe, expect, it } from "vitest";
import { buildProjectAssets } from "../src/core/project-assets.js";
import type { Project } from "../src/schemas/project.js";

describe("buildProjectAssets", () => {
  it("returns unified asset summary and dedupes regex scripts", () => {
    const project = {
      id: "project_test",
      name: "测试",
      revision: 0,
      patches: [],
      characterCardPatches: [],
      pendingDecisions: [],
      recordedDecisions: [],
      imports: [],
      plan: { enabled_assets: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mvuConfig: {
        enabled: true,
        style: "zod",
        schema_script: "registerMvuSchema({})",
        initvar: "foo: 1",
        update_rules: "foo: check",
        variable_list_path: "stat_data",
        hide_regex: true,
        beautify_regex: false,
      },
    } as Project;

    const extraRegexScripts = [
      { scriptName: "额外", findRegex: "/x/g", replaceString: "", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null },
      { scriptName: "额外", findRegex: "/x/g", replaceString: "", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null },
    ];
    const assets = buildProjectAssets(project, "all", extraRegexScripts);
    expect(assets.summary.worldbook_entry_count).toBeGreaterThan(0);
    expect(assets.summary.tavern_helper_script_count).toBeGreaterThan(0);
    expect(assets.regex_scripts.filter((script) => script.scriptName === "额外")).toHaveLength(1);
  });
});
