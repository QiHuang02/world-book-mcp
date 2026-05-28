import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { appendAcceptanceCriterion, appendRisk, appendVerificationStep, ensurePlanFile, readPlan, updatePlanItemStatusNote, upsertPlanItemNote } from "../src/storage/plan-store.js";
import { projectDir } from "../src/storage/workspace-store.js";

const slug = "plan-store-test";

describe("plan-store structured plan helpers", () => {
  it("creates executable plan template and appends structured sections", async () => {
    await fs.rm(projectDir(slug), { recursive: true, force: true });
    await ensurePlanFile(slug);
    await upsertPlanItemNote(slug, {
      id: "entry-world-summary",
      title: "写世界概要条目",
      status: "pending",
      category: "worldbook",
      target: { draftType: "entry", sliceId: "world-summary", tool: "update_entry_content" },
      dependsOn: [],
      acceptance: ["世界概要条目存在"],
      verification: ["validate_project(scope='worldbook')"],
      risks: [],
    });
    await updatePlanItemStatusNote(slug, "entry-world-summary", "done");
    await appendAcceptanceCriterion(slug, "导出前无 blocking");
    await appendVerificationStep(slug, "build_assets(target='all')");
    await appendRisk(slug, "用户尚未确认导出文件名");

    const plan = await readPlan(slug);
    expect(plan).toContain("## 0. Plan Metadata");
    expect(plan).toContain("## 7. Implementation Tasks");
    expect(plan).toContain("- [x] entry-world-summary");
    expect(plan).toContain("导出前无 blocking");
    expect(plan).toContain("build_assets(target='all')");
    expect(plan).toContain("用户尚未确认导出文件名");
  });
});
