import { describe, expect, it } from "vitest";
import {
  hasXmlWrapper,
  normalizeMvuYamlField,
  normalizeWorldbookEntryContent,
  stripYamlDocSeparators,
  unwrapXmlTag,
  wrapWithXmlTag,
} from "../src/utils/yaml-xml.js";

describe("stripYamlDocSeparators", () => {
  it("removes leading `---` line", () => {
    expect(stripYamlDocSeparators("---\nfoo: bar\n")).toBe("foo: bar\n");
  });

  it("removes trailing `---` line", () => {
    expect(stripYamlDocSeparators("foo: bar\n---")).toBe("foo: bar");
  });

  it("removes both leading and trailing", () => {
    expect(stripYamlDocSeparators("---\nfoo: bar\n---")).toBe("foo: bar");
  });

  it("does not remove `...` because it may be natural-language ellipsis", () => {
    expect(stripYamlDocSeparators("---\nfoo: bar\n...\n")).toBe("foo: bar\n...\n");
  });

  it("removes leading `---` after blank lines", () => {
    expect(stripYamlDocSeparators("\n\n---\nfoo: bar")).toBe("foo: bar");
  });

  it("preserves middle `---` so multi-document YAML is not corrupted", () => {
    const input = "foo: 1\n---\nbar: 2";
    expect(stripYamlDocSeparators(input)).toBe(input);
  });

  it("returns empty string when content is just `---`", () => {
    expect(stripYamlDocSeparators("---")).toBe("");
    expect(stripYamlDocSeparators("\n---\n")).toBe("");
  });

  it("strips repeated leading separators", () => {
    expect(stripYamlDocSeparators("---\n---\nfoo: bar")).toBe("foo: bar");
  });

  it("returns empty string unchanged", () => {
    expect(stripYamlDocSeparators("")).toBe("");
  });
});

describe("hasXmlWrapper", () => {
  it("matches simple wrapping", () => {
    expect(hasXmlWrapper("<initvar>\nfoo: 1\n</initvar>", "initvar")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasXmlWrapper("<Initvar>\nfoo\n</Initvar>", "initvar")).toBe(true);
  });

  it("does not match when only opened", () => {
    expect(hasXmlWrapper("<initvar>\nfoo", "initvar")).toBe(false);
  });

  it("does not match a different tag", () => {
    expect(hasXmlWrapper("<other>\nfoo\n</other>", "initvar")).toBe(false);
  });
});

describe("unwrapXmlTag", () => {
  it("removes outer wrapping", () => {
    expect(unwrapXmlTag("<initvar>\nfoo: 1\n</initvar>", "initvar")).toBe("foo: 1");
  });

  it("returns content unchanged when not wrapped", () => {
    expect(unwrapXmlTag("foo: 1", "initvar")).toBe("foo: 1");
  });

  it("is idempotent", () => {
    const once = unwrapXmlTag("<initvar>\nfoo\n</initvar>", "initvar");
    expect(unwrapXmlTag(once, "initvar")).toBe(once);
  });
});

describe("wrapWithXmlTag", () => {
  it("wraps and strips leading `---`", () => {
    expect(wrapWithXmlTag("---\nfoo: 1", "variable_update_rules")).toBe(
      "<variable_update_rules>\nfoo: 1\n</variable_update_rules>",
    );
  });

  it("does not double-wrap when already wrapped with same tag", () => {
    const already = "<variable_update_rules>\nfoo: 1\n</variable_update_rules>";
    expect(wrapWithXmlTag(already, "variable_update_rules")).toBe(already);
  });

  it("strips `---` inside an already wrapped XML-YAML block", () => {
    const already = "<variable_update_rules>\n---\nfoo: 1\n</variable_update_rules>";
    expect(wrapWithXmlTag(already, "variable_update_rules")).toBe(
      "<variable_update_rules>\nfoo: 1\n</variable_update_rules>",
    );
  });

  it("removes leading separator before existing wrap", () => {
    const input = "---\n<variable_update_rules>\nfoo: 1\n</variable_update_rules>";
    expect(wrapWithXmlTag(input, "variable_update_rules")).toBe(
      "<variable_update_rules>\nfoo: 1\n</variable_update_rules>",
    );
  });

  it("returns empty string for empty input", () => {
    expect(wrapWithXmlTag("", "tag")).toBe("");
    expect(wrapWithXmlTag("---", "tag")).toBe("");
  });
});

describe("normalizeWorldbookEntryContent", () => {
  it("strips leading `---` separator", () => {
    expect(normalizeWorldbookEntryContent("---\n<status>foo</status>")).toBe("<status>foo</status>");
  });

  it("strips leading `---` separator after blank lines", () => {
    expect(normalizeWorldbookEntryContent("\n---\n<status>foo</status>")).toBe("<status>foo</status>");
  });

  it("preserves content without separator", () => {
    expect(normalizeWorldbookEntryContent("<status>foo</status>")).toBe("<status>foo</status>");
  });
});

describe("normalizeMvuYamlField", () => {
  it("strips leading `---` and surrounding XML wrapper", () => {
    expect(
      normalizeMvuYamlField("---\n<variable_update_rules>\nfoo: 1\n</variable_update_rules>", [
        "variable_update_rules",
      ]),
    ).toBe("foo: 1");
  });

  it("returns plain YAML untouched", () => {
    expect(normalizeMvuYamlField("foo: 1", ["initvar"])).toBe("foo: 1");
  });
});
