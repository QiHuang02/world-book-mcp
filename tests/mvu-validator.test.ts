import { describe, expect, it } from "vitest";
import { validateMvuConfig } from "../src/core/mvu-validator.js";
import { createMvuTemplate } from "../src/core/mvu-template.js";

describe("validateMvuConfig", () => {
  it("accepts generated template", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu });
    expect(result.valid).toBe(true);
  });

  it("rejects missing registerMvuSchema", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, schema_script: "export const Schema = z.object({});" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.field === "schema_script")).toBe(true);
  });

  it("warns about wrapped initvar", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, initvar: "<initvar>\n角色A: {}\n</initvar>" } });
    expect(result.warnings.some((issue) => issue.field === "initvar")).toBe(true);
  });

  it("rejects unsupported zod methods", () => {
    const { mvu } = createMvuTemplate({ characterNames: ["角色A"] });
    const result = validateMvuConfig({ mvu: { ...mvu, schema_script: "registerMvuSchema(Schema); z.object({ a: z.string().optional() })" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.message.includes("optional"))).toBe(true);
  });
});
