import { describe, expect, it } from "vitest";
import { buildEjsEntries } from "../src/core/ejs-entries.js";
import { createEjsTemplate } from "../src/core/ejs-template.js";

describe("buildEjsEntries", () => {
  it("converts ejs config to worldbook draft entries", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const result = buildEjsEntries(ejs);
    expect(result.worldbookEntries.length).toBeGreaterThan(0);
    expect(result.worldbookEntries[0].preventRecursion).toBe(true);
    expect(result.worldbookEntries.some((entry) => !entry.enabled)).toBe(true);
  });
});
