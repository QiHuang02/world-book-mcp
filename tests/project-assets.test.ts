import { describe, expect, it } from "vitest";
import { buildProjectAssets } from "../src/core/project-assets.js";
import { defaultProjectKind, type Project } from "../src/schemas/project.js";

describe("buildProjectAssets", () => {
  it("returns unified asset summary and dedupes regex scripts", () => {
    const project = {
      schemaVersion: 4,
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
        schemaScript: "export const Schema = z.object({ foo: z.string().prefault('') });\nregisterMvuSchema(Schema);",
        variableListPath: "stat_data",
        hideRegex: true,
        beautifyRegex: false,
      },
      draft: [{
        comment: "[initvar]变量初始化",
        entryType: "other",
        keys: [],
        secondaryKeys: [],
        content: "<initvar>\nfoo: 1\n</initvar>",
        constant: true,
        position: "at_depth",
        order: 14720,
        enabled: true,
        depth: 0,
        preventRecursion: true,
        excludeRecursion: true,
      }],
    } as Project & { mvuConfig: import("../src/schemas/mvu.js").MvuConfig; draft: import("../src/schemas/worldbook-draft.js").WorldbookDraftEntry[] };

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
    expect(assets.summary.entry_count).toBe(1);
    expect(assets.summary.tavern_helper_script_count).toBeGreaterThan(0);
    expect(assets.regex_scripts.filter((script) => script.scriptName === "额外")).toHaveLength(1);
  });

  it("does not emit MVU system entries from runtime config", () => {
    const project = {
      schemaVersion: 4,
      id: "project_test",
      slug: "project_test",
      name: "测试",
      kind: defaultProjectKind({ output: "worldbook", source: "original", assets: { mvu: true } }),
      revision: 0,
      pendingDecisions: [],
      recordedDecisions: [],
      imports: [],
      plan: { enabled_assets: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mvuConfig: {
        schemaScript: "export const Schema = z.object({ foo: z.string().prefault('') });\nregisterMvuSchema(Schema);",
        variableListPath: "stat_data",
        hideRegex: true,
        beautifyRegex: false,
      },
    } as Project & { mvuConfig: import("../src/schemas/mvu.js").MvuConfig };
    const assets = buildProjectAssets(project, "all", []);
    expect(assets.worldbook_entries).toEqual([]);
    expect(assets.tavern_helper_scripts.some((script) => script.name === "变量结构")).toBe(true);
  });
});
