import { describe, expect, it } from "vitest";
import { buildProjectAssets } from "../src/core/project-assets.js";
import { defaultProjectKind, type Project } from "../src/schemas/project.js";

describe("buildProjectAssets", () => {
  it("returns unified asset summary and dedupes regex scripts", () => {
    const project = {
      schemaVersion: 3,
      id: "project_test",
      slug: "project_test",
      name: "测试",
      kind: defaultProjectKind({ output: "worldbook", source: "original", assets: { mvu: true, regex: true } }),
      revision: 0,
      pendingDecisions: [],
      recordedDecisions: [],
      imports: [],
      plan: { enabled_assets: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mvuConfig: {
        enabled: true,
        style: "zod",
        schemaScript: "registerMvuSchema({})",
        initvar: "foo: 1",
        updateRules: "foo: check",
        variableListPath: "stat_data",
        hideRegex: true,
        beautifyRegex: false,
      },
    } as Project;

    const regexSlices = [{
      id: "extra",
      data: {
        order: 100,
        purpose: "standalone" as const,
        scripts: [
          { id: "extra-a", scriptName: "额外", findRegex: "/x/g", replaceString: "", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null },
          { id: "extra-b", scriptName: "额外", findRegex: "/x/g", replaceString: "", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null },
        ],
      },
    }];
    const assets = buildProjectAssets(project, "all", regexSlices);
    expect(assets.summary.entry_count).toBeGreaterThan(0);
    expect(assets.summary.tavern_helper_script_count).toBeGreaterThan(0);
    expect(assets.regex_scripts.filter((script) => script.scriptName === "额外")).toHaveLength(1);
  });
});
