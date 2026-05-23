# world-book-mcp

`world-book-mcp` is an MCP server for creating, modifying, validating, and exporting SillyTavern World Book JSON and `chara_card_v3` character card JSON.

## Main workflow

```text
User request
→ init_project
→ update_plan
→ create_draft_slice
→ update_draft_field / update_draft_fields
→ validate_draft
→ build_assets (optional)
→ generate_json
```

## Workspace

`init_project` creates:

```text
.worldbook/
  project.json
  plan.md
  logs/
  draft/
    worldbook/
    character-card/
    mvu/
    html/
    ejs/
    style/
    chapter/
```

It scans existing SillyTavern JSON files in the current directory and slices existing World Book entries, character card profile, greetings, MVU, HTML, EJS, and regex assets into draft files.

## Core tools

| Tool | Purpose |
|---|---|
| `init_project` | Initialize `.worldbook/`, scan and slice existing Tavern JSON. |
| `update_plan` | Write `.worldbook/plan.md` with requirements, decisions, and export target. |
| `create_draft_slice` | Create draft slices for World Book, character card, MVU, HTML, EJS, etc. |
| `update_draft_field` | Update one draft field. |
| `update_draft_fields` | Update multiple fields in one draft slice. |
| `list_draft_slices` | List draft slices. |
| `get_draft_slice` | Read one draft slice. |
| `delete_draft_slice` | Delete one draft slice. |
| `validate_draft` | Validate World Book, character card, MVU, HTML, and EJS drafts. |
| `build_assets` | Preview assets that will be merged into a character card. |
| `generate_json` | Export World Book JSON, character card JSON, or both. |
| `query_json` | Query exported JSON. |

## Draft types

- `worldbook_entry`
- `character_profile`
- `character_greetings`
- `mvu_schema`
- `mvu_update_rules`
- `html_statusbar`
- `html_regex`
- `ejs_entry`
- `style_profile`
- `chapter_outline`

## Modifying existing JSON

The old import/patch/apply workflow has been removed. To modify an existing character card or World Book:

```text
init_project(scan_existing=true, import_strategy="auto")
→ list_draft_slices / get_draft_slice
→ update_plan
→ update_draft_field(s)
→ validate_draft
→ generate_json
```

## Logs

MCP silently records tool-call summaries in:

```text
.worldbook/logs/latest.jsonl
.worldbook/logs/<session>.jsonl
```

Long text fields are summarized with preview, length, and hash.
