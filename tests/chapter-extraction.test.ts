import { describe, expect, it } from "vitest";
import { registerTools } from "../src/tools/register.js";

describe("delegated chapter workflow", () => {
  it("does not register subjective chapter extraction tools from MCP core", () => {
    const names: string[] = [];
    registerTools({ tool: (name: string) => { names.push(name); } } as never);
    expect(names).not.toContain("create_chapter_extraction_template");
    expect(names).not.toContain("build_chapter_worldbook_entries");
  });
});
