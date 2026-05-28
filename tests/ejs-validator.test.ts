import { describe, expect, it } from "vitest";
import { createEjsTemplate } from "../src/core/ejs-template.js";
import { validateEjsConfig } from "../src/core/ejs-validator.js";
import type { MvuConfig } from "../src/schemas/mvu.js";

const mvu: MvuConfig = { enabled: true, style: "zod", schemaScript: "registerMvuSchema", initvar: "a: 1", updateRules: "rules", variableListPath: "stat_data", hideRegex: true, beautifyRegex: true };

describe("validateEjsConfig", () => {
  it("accepts generated template with mvu", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const result = validateEjsConfig({ ejs, mvu });
    expect(result.valid).toBe(true);
  });

  it("requires mvu", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const result = validateEjsConfig({ ejs });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "mvu")).toBe(true);
  });

  it("rejects non stat_data paths", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const result = validateEjsConfig({ ejs: { ...ejs, entries: [{ ...ejs.entries[0], variablePaths: ["角色A.好感度"] }] }, mvu });
    expect(result.valid).toBe(false);
  });

  it("warns about preprocessing decorator conflicts", () => {
    const { ejs } = createEjsTemplate({ templateType: "phase_profile", characterName: "角色A" });
    const entry = { ...ejs.entries[0], content: "@preprocessing\n@generate_before\n内容" };
    const result = validateEjsConfig({ ejs: { ...ejs, entries: [entry] }, mvu });
    expect(result.warnings.some((issue) => issue.message.includes("@preprocessing"))).toBe(true);
  });
});
