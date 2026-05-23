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
- Importing existing character card JSON and applying patches to profile fields or embedded World Book entries.

Not supported yet:
- Built-in web search.

## `.worldbook/` Workspace

The primary role of `init_project` is to create or reuse the single MCP workspace project in the current project directory. Project metadata is stored only in `.worldbook/project.json`, and split draft entries are stored in `.worldbook/draft/`; the old `output/projects` storage path is no longer created or read:

```text
.
├─ .worldbook/
│  ├─ project.json          # project metadata; draft body is split out
│  └─ draft/
│     ├─ 新墟城.json
│     ├─ 角色B_基础设定.json
│     └─ 角色B_性格.json
└─ <exported world book or character card>.json
```

`upsert_worldbook_entry` / `upsert_worldbook_entries` write each draft entry to `.worldbook/draft/<safe-comment>.json`. Split files store MCP draft entries, not final SillyTavern entries:

```json
{
  "comment": "新墟城",
  "entryType": "world_summary",
  "keys": ["新墟", "废墟都市", "避难城"],
  "secondaryKeys": [],
  "content": "...",
  "constant": true,
  "position": "before_char",
  "order": 1,
  "enabled": true,
  "preventRecursion": true,
  "excludeRecursion": true
}
```

Validation, review, lint, World Book export, and character card export preferentially merge `.worldbook/draft/*.json`; if no split draft exists, they fall back to legacy `project.draft`. By default, exports are written to `<name>.json` in the current working directory. Relative and absolute output paths must stay inside the current working directory; out-of-bound writes are rejected.

`init_project` also scans one level of `*.json` files in the current working directory. If no SillyTavern World Book or `chara_card_v3` JSON exists, it safely creates a root template JSON. If a Tavern-format JSON already exists, it does not create another template and never overwrites existing JSON files. The returned `root_template` field reports whether a template was created, its path, or the existing files that caused creation to be skipped. `kind=worldbook` creates a standalone World Book template; `kind=character_card` and `kind=mixed` create a `chara_card_v3` template, with `mixed` explicitly meaning a character card plus an empty embedded World Book.

## Patches, Revisions, and Concurrency

Writes for the same `project_id` are serialized inside the MCP process and return an incremented `revision`. Tools that accept `expected_revision` can use it for concurrency control: if a caller writes based on a stale revision, the tool returns a `project revision conflict` error.

`apply_worldbook_patch` / `apply_character_card_patch` write the exported JSON file and update project state together. The implementation writes a temp file, replaces the target file, then updates the project; if the project update fails, it best-effort restores the previous exported file or removes the newly written target. When a patch returns `ok=false` or throws a revision conflict, reload the project before retrying.

Patch `match.uid` first matches the `sourceUid` preserved from an imported World Book, so it targets the original SillyTavern entry uid. For newly created drafts or legacy projects without `sourceUid`, prefer `index` or a unique `comment` to avoid confusing uid with the regenerated contiguous export index.

## Tools Overview

Task routing, workflow choice, and clarification strategy are handled by the bundled `skill/world-book-mcp/` documentation rather than MCP tools.

| Category | Tool | Description |
| --- | --- | --- |
| Workflow, Projects, and Specs | `init_project` | Initializes `.worldbook/project.json` and `.worldbook/draft/`; safely creates a root template JSON when no Tavern-format JSON exists; existing projects can be reused or overwritten with `if_exists`. |
| Workflow, Projects, and Specs | `list_projects` | Returns the current `.worldbook/project.json` workspace project, or an empty list if no workspace exists. |
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
| World Book Building | `list_worldbook_draft_entries` | Lists `.worldbook/draft/*.json` split draft entries. |
| World Book Building | `get_worldbook_draft_entry` | Reads one split draft entry by comment. |
| World Book Building | `delete_worldbook_draft_entry` | Deletes one split draft entry by comment. |
| World Book Building | `validate_worldbook_draft` | Validates draft configuration and content issues. |
| World Book Building | `generate_worldbook_json` | Exports SillyTavern World Book JSON. |
| Character Card | `import_character_card_json` | Imports an existing `chara_card_v3` JSON in the current directory and extracts profile plus embedded World Book draft. |
| Character Card | `upsert_character_profile` | Creates or updates character card profile configuration through simplified fields; MCP automatically fills default `chara_card_v3` fields. |
| Character Card | `validate_character_card_config` | Validates character card configuration and the embedded World Book. |
| Character Card | `generate_character_card_json` | Exports `chara_card_v3` character card JSON; `character_basic` and `character_personality` for the same character are merged into the same embedded World Book entry. |
| Character Card | `create_character_card_patch` | Creates a patch plan for profile, worldbook config, or embedded World Book entries. |
| Character Card | `preview_character_card_patch` | Previews character card patch diffs and validation. |
| Character Card | `apply_character_card_patch` | Applies a character card patch, safely exports JSON, and updates the project. |
| Character Card | `query_character_card` | Queries the character card summary, greetings, or embedded World Book entries. |
| MVU / ZOD | `create_mvu_schema_template` | Creates an MVU/ZOD variable system configuration template. |
| MVU / ZOD | `upsert_mvu_schema` | Partially updates MVU schema and variable path. |
| MVU / ZOD | `upsert_mvu_update_rules` | Partially updates MVU initvar and update rules. |
| MVU / ZOD | `submit_mvu_config` | Advanced entry: saves the full MVU configuration. |
| MVU / ZOD | `validate_mvu_config` | Validates ZOD schema, initvar, update_rules, and greeting placeholders. |
| MVU / ZOD | `build_mvu_assets` | Previews World Book entries, regex scripts, and Tavern Helper scripts that will be merged into the character card. |
| HTML Beautification | `create_html_beautify_template` | Creates a status-bar or global HTML beautification configuration template. |
| HTML Beautification | `upsert_html_statusbar` | Partially updates statusbar HTML, theme, and switches. |
| HTML Beautification | `submit_html_beautify_config` | Advanced entry: saves the full HTML beautification configuration. |
| HTML Beautification | `validate_html_beautify_config` | Validates HTML, CSS scope, regex configuration, and greeting placeholders. |
| HTML Beautification | `build_html_beautify_assets` | Previews regex scripts that will be merged into the character card. |
| EJS Dynamic Content | `create_ejs_template` | Creates a staged character profile, palette, or custom EJS template. |
| EJS Dynamic Content | `upsert_ejs_entry` | Partially adds or updates one EJS entry by name. |
| EJS Dynamic Content | `submit_ejs_config` | Advanced entry: saves the full EJS configuration. |
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
