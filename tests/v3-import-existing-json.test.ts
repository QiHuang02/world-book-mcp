import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importExistingJson } from "../src/core/import-existing-json.js";
import { readDraftSlice } from "../src/storage/draft-store.js";
import { ROOT_DIR } from "../src/storage/path-policy.js";
import { initWorkspaceProject, WORKSPACE_DIR } from "../src/storage/workspace-store.js";

async function cleanup(): Promise<void> {
  await fs.rm(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 10 });
  await fs.rm(path.resolve(ROOT_DIR, "导入正则角色卡.json"), { force: true });
}

describe("v3 existing JSON import", () => {
  it("imports third-party regex scripts into a regex slice", async () => {
    await cleanup();
    const filePath = path.resolve(ROOT_DIR, "导入正则角色卡.json");
    await fs.writeFile(filePath, JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name: "导入角色",
        first_mes: "你好。",
        alternate_greetings: [],
        character_book: { name: "导入世界书", entries: [] },
        extensions: {
          regex_scripts: [
            { scriptName: "第三方正则", findRegex: "/foo/g", replaceString: "bar", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null },
            { scriptName: "[界面]状态栏", findRegex: "/<StatusPlaceHolderImpl\\/>/gs", replaceString: "<![CDATA[\n<div class='wbm-statusbar'>{{stat_data.current_zone}}</div>\n]]>", trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null },
          ],
        },
      },
    }), "utf8");

    const { project, slug } = await initWorkspaceProject({ name: "导入测试", output: "character_card", source: "modify_existing", opening: { mode: "event_hook", user_role: "unspecified", premise: "导入角色遇见 user。", user_constraints: [] }, ifExists: "error" });
    const result = await importExistingJson(project, slug, { path: filePath });

    expect(result.created_slices.some((slice) => slice.type === "regex")).toBe(true);
    const regexSliceInfo = result.created_slices.find((slice) => slice.type === "regex")!;
    const regexSlice = await readDraftSlice(slug, "regex", regexSliceInfo.id);
    const scripts = (regexSlice.data as { scripts: Array<{ scriptName: string; replaceString: string }> }).scripts;
    expect(scripts[0].scriptName).toBe("第三方正则");
    const statusbar = scripts.find((script) => script.scriptName.includes("状态栏"));
    expect(statusbar?.replaceString).not.toContain("CDATA");
    expect(statusbar?.replaceString).not.toContain("{{stat_data");
    expect(statusbar?.replaceString).toContain("{{format_message_variable::stat_data.current_zone}}");
    await cleanup();
  });
});
