import { describe, expect, it } from "vitest";
import { registerTools } from "../src/tools/register.js";

describe("delegated derivative extraction workflow", () => {
  it("does not register derivative extraction tools from MCP core", () => {
    const names: string[] = [];
    registerTools({ tool: (name: string) => { names.push(name); } } as never);
    expect(names).not.toContain("create_derivative_extraction_template");
    expect(names).not.toContain("submit_derivative_extraction_outline");
    expect(names).not.toContain("validate_derivative_extraction_outline");
  });
});
