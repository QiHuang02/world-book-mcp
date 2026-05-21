import { describe, expect, it } from "vitest";
import { validateItemEntry } from "../src/core/item-entry-validator.js";

describe("validateItemEntry", () => {
  it("warns about clothing pros and cons", () => {
    const result = validateItemEntry({ item_kind: "clothing", content: "<item>\n米白衬衫，优点是舒适显瘦\n</item>" });
    expect(result.warnings.some((issue) => issue.message.includes("服装"))).toBe(true);
  });

  it("warns about exact special item sizes", () => {
    const result = validateItemEntry({ item_kind: "special_item", content: "<item>\n长度18厘米\n</item>" });
    expect(result.warnings.some((issue) => issue.message.includes("精确"))).toBe(true);
  });

  it("warns about vague ability strength", () => {
    const result = validateItemEntry({ item_kind: "ability", content: "<ability>\n强大无敌\n</ability>" });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
