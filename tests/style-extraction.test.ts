import { describe, expect, it } from "vitest";
import { registerTools } from "../src/tools/register.js";

describe("delegated style workflow", () => {
  it("does not register subjective style extraction tools from MCP core", () => {
    const names: string[] = [];
    registerTools({ tool: (name: string) => { names.push(name); } } as never);
    expect(names).not.toContain("create_style_extraction_template");
    expect(names).not.toContain("submit_style_profile");
    expect(names).not.toContain("build_style_worldbook_entries");
  });
});
