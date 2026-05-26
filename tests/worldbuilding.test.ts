import { describe, expect, it } from "vitest";
import { registerTools } from "../src/tools/register.js";

describe("delegated worldbuilding workflow", () => {
  it("does not register subjective worldbuilding tools from MCP core", () => {
    const names: string[] = [];
    registerTools({ tool: (name: string) => { names.push(name); } } as never);
    expect(names).not.toContain("create_worldbuilding_outline");
    expect(names).not.toContain("create_worldbuilding_design_template");
    expect(names).not.toContain("validate_worldbuilding_design");
  });
});
