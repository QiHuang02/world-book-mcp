import { describe, expect, it } from "vitest";
import { createEjsPhasePlan } from "../src/core/ejs-phase-plan.js";

describe("createEjsPhasePlan", () => {
  it("builds controller and stage entries with correct activation", () => {
    const result = createEjsPhasePlan({
      character_name: "角色A",
      affection_path: "stat_data.角色A.好感度",
      relationship_path: "stat_data.角色A.关系状态",
      phases: [
        { name: "初识", affection_max_exclusive: 150, short_name: "初识" },
        { name: "熟悉", affection_min_inclusive: 150, affection_max_exclusive: 400, short_name: "熟悉" },
        { name: "恋人", relationship_equals: "恋人", short_name: "恋人" },
      ],
    });
    expect(result.ejs.entries[0].role).toBe("controller");
    expect(result.ejs.entries[0].enabled).toBe(true);
    expect(result.ejs.entries[0].constant).toBe(true);
    expect(result.ejs.entries[1].role).toBe("stage");
    expect(result.ejs.entries[1].enabled).toBe(false);
    expect(result.ejs.entries.flatMap((entry) => entry.variablePaths)).toContain("stat_data.角色A.好感度");
    expect(result.phase_table[0].condition).toContain("gw <");
    expect(result.ejs.entries[0].content).toContain("await getwi");
  });
});
