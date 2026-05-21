import { describe, expect, it } from "vitest";
import { getCapabilityMatrix } from "../src/core/capability-matrix.js";

describe("getCapabilityMatrix", () => {
  it("covers all worldbook-skill task classes", () => {
    const matrix = getCapabilityMatrix();
    expect(matrix.entries).toHaveLength(12);
    expect(matrix.entries.map((entry) => entry.task_type)).toContain("original_character_card");
    expect(matrix.entries.map((entry) => entry.task_type)).toContain("content_lint");
  });

  it("returns a single task entry when filtered", () => {
    const matrix = getCapabilityMatrix("mvu_zod");
    expect(matrix.entries).toHaveLength(1);
    expect(matrix.entries[0].primary_tools).toContain("validate_mvu_config");
  });

  it("attaches decision_hint to every entry", () => {
    const matrix = getCapabilityMatrix();
    for (const entry of matrix.entries) {
      expect(["auto", "prefer_clarification"]).toContain(entry.decision_hint);
    }
    const queryEntry = matrix.entries.find((entry) => entry.task_type === "query_existing");
    expect(queryEntry?.decision_hint).toBe("auto");
    const charEntry = matrix.entries.find((entry) => entry.task_type === "original_character_card");
    expect(charEntry?.decision_hint).toBe("prefer_clarification");
  });
});
