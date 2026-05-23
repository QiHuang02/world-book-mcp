import { describe, expect, it } from "vitest";
import { extractThirdPartyAssetsFromCharacterCard } from "../src/core/third-party-asset-importer.js";
import type { WorldbookDraftEntry } from "../src/schemas/worldbook-draft.js";

const baseEntry = (comment: string, content: string): WorldbookDraftEntry => ({
  comment,
  entryType: "other",
  keys: [],
  secondaryKeys: [],
  content,
  constant: true,
  position: "before_char",
  order: 10,
  enabled: true,
  preventRecursion: true,
  excludeRecursion: true,
});

describe("third-party asset importer", () => {
  it("detects MVU, HTML statusbar, EJS and removes asset entries from normal worldbook draft", () => {
    const result = extractThirdPartyAssetsFromCharacterCard({
      idPrefix: "card-assets",
      card: {
        data: {
          extensions: {
            regex_scripts: [
              { scriptName: "[界面]状态栏", findRegex: "/<StatusPlaceHolderImpl\\/>/gs", replaceString: "<div class=\"wbm-statusbar\"></div>", markdownOnly: true, promptOnly: false, placement: [2], runOnEdit: true },
              { scriptName: "[不发送]去除变量更新", findRegex: "/<UpdateVariable>(.*?)<\\/UpdateVariable>/gis", replaceString: "", markdownOnly: false, promptOnly: true, placement: [1, 2] },
            ],
            tavern_helper: [["scripts", [{ name: "变量结构", content: "registerMvuSchema({})" }]]],
          },
        },
      },
      worldbookDraft: [
        baseEntry("角色设定", "普通设定"),
        baseEntry("[initvar]变量初始化勿开", "<initvar>\nfoo: 1\n</initvar>"),
        baseEntry("[mvu_update]变量更新规则", "foo: check"),
        baseEntry("阶段控制", "<% var mood = getvar('stat_data.role.mood') %>"),
      ],
    });

    expect(result.summary.detected_mvu).toBe(true);
    expect(result.summary.detected_html).toBe(true);
    expect(result.summary.detected_ejs).toBe(true);
    expect(result.retainedWorldbookEntries.map((entry) => entry.comment)).toEqual(["角色设定"]);
    expect(result.draftSlices.some((slice) => slice.type === "mvu_schema")).toBe(true);
    expect(result.draftSlices.some((slice) => slice.type === "mvu_update_rules")).toBe(true);
    expect(result.draftSlices.some((slice) => slice.type === "html_statusbar")).toBe(true);
    expect(result.draftSlices.some((slice) => slice.type === "ejs_entry")).toBe(true);
  });
});
