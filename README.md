# world-book-mcp

`world-book-mcp` is an MCP server built with Node.js and TypeScript. It helps AI organize information from text or web-search summaries and export SillyTavern-compatible World Book JSON, basic `chara_card_v3` character card JSON, and optional MVU/ZOD, HTML beautification, and EJS dynamic content assets.

## Installation

### JSON format

```json
{
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "@qihuang02/world-book-mcp"
  ]
}
```

### Claude Code format

```json
"mcpServers": {
  "world-book-mcp": {
    "type": "stdio",
    "command": "cmd",
    "args": [
      "/c",
      "npx",
      "-y",
      "@qihuang02/world-book-mcp"
    ]
  }
}
```

### Codex format

```toml
[mcp_servers.world-book-mcp]
type = "stdio"
command = "npx"
args = ["-y", "@qihuang02/world-book-mcp"]
# startup_timeout_sec = 60000.0
```

## Current Capabilities

The current version supports:

- Ingesting text materials.
- Ingesting web-search summaries.
- Creating information extraction outlines.
- Submitting structured extraction results.
- Automatically planning World Book entries.
- Returning World Book entry templates.
- Querying the usage guide for a single tool.
- Explaining SillyTavern World Book configuration fields.
- Scanning forbidden terms and common writing issues.
- Explicitly initializing a project, suitable for first-time use in an empty directory.
- Saving, updating, and validating World Book drafts through simplified input: AI only needs to submit core fields such as `comment`, `keys`, and `content`; MCP automatically completes the full structure.
- Exporting standalone SillyTavern World Book JSON.
- Importing existing World Book JSON and applying safe patches.
- Generating basic character card JSON that can embed the project World Book draft; when exporting a character card, the basic settings and personality settings of the same character are merged into the same embedded World Book entry.
- MVU/ZOD configuration templates, validation, and asset building, with automatic merging into character card JSON.
- HTML beautification configuration templates, validation, and asset building, with automatic merging into character card JSON.
- EJS dynamic content configuration templates, validation, and entry building, with automatic merging into the embedded World Book of a character card.
- Querying exported World Book JSON and character card JSON.

Not supported yet:
- Built-in web search.

## Tools Overview

| Category | Tool | Description |
| --- | --- | --- |
| Workflow, Projects, and Specs | `get_worldbook_workflow` | Returns the recommended tool flow for a task type. When `wants_character_card=true`, the character card flow is appended automatically. |
| Workflow, Projects, and Specs | `get_tool_usage_guide` | Queries a tool's purpose, when to call it, required fields, sample input, common mistakes, and next steps. |
| Workflow, Projects, and Specs | `init_project` | Explicitly initializes the current workspace project and returns the `project_id`, `revision`, and `.worldbook` path; existing projects can be reused or overwritten with `if_exists`. |
| Workflow, Projects, and Specs | `list_projects` | Lists locally saved MCP projects. |
| Workflow, Projects, and Specs | `get_project` | Views project details or a summary. |
| Workflow, Projects, and Specs | `get_entry_template` | Returns a World Book entry template. |
| Workflow, Projects, and Specs | `explain_worldbook_config` | Explains configuration fields such as position, constant, order, keys, and recursion. |
| Workflow, Projects, and Specs | `lint_worldbook_content` | Scans forbidden terms and common writing issues. |
| Material Input | `ingest_text_source` | Ingests novel excerpts, settings, user notes, and other text. |
| Material Input | `ingest_web_research` | Ingests web-search summaries organized by AI. |
| Extraction | `create_extraction_outline` | Creates an extraction template for characters, worldbuilding, items, and events. |
| Extraction | `submit_extraction_result` | Submits structured facts extracted by the main AI. |
| World Book Building | `plan_worldbook_entries` | Plans an entry table from extraction results. |
| World Book Building | `upsert_worldbook_entry` | Adds or updates a single entry through simplified input; MCP automatically completes the full configuration. |
| World Book Building | `upsert_worldbook_entries` | Adds or updates multiple entries through simplified input. |
| World Book Building | `update_worldbook_draft_entries` | Partially updates draft entries by index or comment. |
| World Book Building | `validate_worldbook_draft` | Validates draft configuration and content issues. |
| World Book Building | `generate_worldbook_json` | Exports SillyTavern World Book JSON. |
| Character Card | `upsert_character_profile` | Creates or updates character card profile configuration through simplified fields; MCP automatically fills default `chara_card_v3` fields. |
| Character Card | `validate_character_card_config` | Validates character card configuration and the embedded World Book. |
| Character Card | `generate_character_card_json` | Exports `chara_card_v3` character card JSON; `character_basic` and `character_personality` for the same character are merged into the same embedded World Book entry. |
| Character Card | `query_character_card` | Queries the character card summary, greetings, or embedded World Book entries. |
| MVU / ZOD | `create_mvu_schema_template` | Creates an MVU/ZOD variable system configuration template. |
| MVU / ZOD | `submit_mvu_config` | Saves MVU configuration. |
| MVU / ZOD | `validate_mvu_config` | Validates ZOD schema, initvar, update_rules, and greeting placeholders. |
| MVU / ZOD | `build_mvu_assets` | Previews World Book entries, regex scripts, and Tavern Helper scripts that will be merged into the character card. |
| HTML Beautification | `create_html_beautify_template` | Creates a status-bar or global HTML beautification configuration template. |
| HTML Beautification | `submit_html_beautify_config` | Saves HTML beautification configuration. |
| HTML Beautification | `validate_html_beautify_config` | Validates HTML, CSS scope, regex configuration, and greeting placeholders. |
| HTML Beautification | `build_html_beautify_assets` | Previews regex scripts that will be merged into the character card. |
| EJS Dynamic Content | `create_ejs_template` | Creates a staged character profile, palette, or custom EJS template. |
| EJS Dynamic Content | `submit_ejs_config` | Saves EJS configuration. |
| EJS Dynamic Content | `validate_ejs_config` | Validates MVU dependencies, variable paths, EJS tags, getwi references, and entry status. |
| EJS Dynamic Content | `build_ejs_entries` | Previews EJS entries that will be merged into the embedded World Book of a character card. |
| Query and Patch | `query_worldbook` | Queries existing World Book JSON, supporting `brief`, `uid`, `search`, and `stats`. |
| Query and Patch | `import_worldbook_json` | Imports an existing World Book JSON in the current working directory as an MCP project draft. |
| Query and Patch | `create_worldbook_patch` | Creates a modification plan without directly writing files. |
| Query and Patch | `preview_worldbook_patch` | Previews the patch diff and validation results. |
| Query and Patch | `apply_worldbook_patch` | Applies a patch, validates it automatically, and can back up and export a new JSON. |

## Skill

This repository includes a standard Claude Code Skill at [`skill/world-book-mcp/`](skill/world-book-mcp/). It is a directory package containing `SKILL.md` and `references/`, used to guide AI in correctly orchestrating all tools of this MCP server when users request World Book or character card related tasks.

## Future Capability Extensions

The following capabilities are not implemented yet and are only references for the future roadmap:

- Cross-project template reuse: derive a World Book or character card template from one project and apply it to a new project.
- World Book entry cross-reference graph: analyze keys and secondaryKeys to output entry trigger dependency graphs.
- Multilingual lint dictionaries: pluggable forbidden-term lists with support for English, Japanese, and more.
- Character relationship graph export: generate relationship graph JSON from `character_basic` relationship fields.
- Embedded World Book conflict detection: detect duplicate keys or orders when merging character cards and project World Books.
- Decision template library: common ambiguity templates such as card type, world type, and style can be referenced by tools.
- Worldbook diff tool: compare two SillyTavern JSON files.
- ChatLog extraction: extract character behavior evidence from a dialogue history.
- Automatic entry reordering: automatically resolve conflicts based on position and order rules.
- Status-bar HTML AST validation: perform stricter safety checks with a lightweight HTML parser.
- Multi-character-card collaboration: maintain multiple character card configs in one project and switch exports as needed.
- Worldbook asset signing: attach version and signature data during JSON export for traceability.

## License

MIT
