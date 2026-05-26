# world-book-mcp

An MCP server for creating, modifying, validating, and exporting SillyTavern World Book JSON and `chara_card_v3` character card JSON.

## Architecture

The project consists of two layers:

```text
┌─────────────────────────────────────────────────────────┐
│  Skill Layer (skill/world-book-mcp-skill/)              │
│  Creative methodology: guides AI on worldbuilding,      │
│  character design, style extraction, derivative         │
│  extraction from novels/web resources, first messages   │
│  Output: high-quality structured content                │
└────────────────────────────┬────────────────────────────┘
                             │ AI calls MCP tools to write project/drafts
┌────────────────────────────▼────────────────────────────┐
│  MCP Layer (src/)                                       │
│  Engineering orchestrator: manages a multi-project      │
│  workspace, draft slices, consistency validation,       │
│  MVU/EJS/HTML asset builds, and SillyTavern JSON export │
│  Output: ready-to-import SillyTavern JSON files         │
└─────────────────────────────────────────────────────────┘
```

## Main Workflow

```text
User request
→ init_project
→ update_plan (record requirements, decisions, export target)
→ update_character_profile / update_character_greetings (for character cards)
→ create_draft_slice / update_draft_field(s) (write entry/mvu/html/ejs)
→ validate_draft (check consistency)
→ build_assets (optional, preview MVU/EJS/HTML assets)
→ review_project / check_delivery (pre-export review)
→ generate_json (export)
```

## Skill Layer — Creative Methodology

`skill/world-book-mcp-skill/` contains reference documents that guide AI content creation:

| Document | Content |
|----------|---------|
| `worldbuilding-methodology.md` | World design: A/B/C type classification, dimension selection, zero-degree writing |
| `character-creation.md` | Character design: XML+YAML structure, personality palette, tri-faceted method |
| `derivative-extraction.md` | Derivative extraction: systematic extraction from novels/web resources |
| `style-extraction-guide.md` | Style extraction: analyze source material and produce style/forbidden-word entries |
| `rephrase-guide.md` | Rephrase: author's deep annotations to prevent AI misinterpretation |
| `content-rules.md` | Content rules: forbidden words, specificity, fourth wall |
| `first-message.md` | First message rules: hooks, plot momentum, interaction points |
| `composition.md` | Entry composition: blue/green light, position, order, DoubleCheck |
| `requirements.md` | Requirements alignment: themed questioning and user decisions |
| `tool-reference.md` | MCP tool parameter quick reference and legacy-name mapping |

## MCP Layer — Engineering Orchestration

### Workspace Structure

`init_project` creates a v2 multi-project workspace:

```text
.worldbook/
  workspace.json
  projects/
    <slug>/
      project.json
      plan.md
      slices/
        entries/*.json     # draft_type="entry"
        assets/*.json      # draft_type="mvu" | "html" | "ejs"
  shared/
    entries/*.json
    assets/*.json
    registry.json
  logs/
    latest.jsonl
    <session>.jsonl
```

It scans existing SillyTavern JSON files in the current directory:

- World Book entries → `entry` slices.
- Character card profile / greetings → project metadata.
- MVU / HTML / EJS / regex assets → `mvu`, `html`, and `ejs` slices.

### Core Tools

| Tool | Purpose |
|------|---------|
| `init_project` | Initialize the `.worldbook/` multi-project workspace and import existing Tavern JSON |
| `list_projects` / `get_project` | Inspect projects and hydrated project state |
| `update_plan` | Write requirements, decisions, and export targets to `plan.md` |
| `update_character_profile` | Update character-card profile metadata; description defaults to empty |
| `update_character_greetings` | Update first_mes / alternate_greetings |
| `create_draft_slice` | Create an `entry/mvu/html/ejs` draft slice |
| `update_draft_field` / `update_draft_fields` | Update draft fields, including nested dot paths |
| `validate_draft` | Validate World Book, character card, MVU, EJS, HTML drafts |
| `build_assets` | Preview assets that will be merged into a character card |
| `review_project` / `check_delivery` | Pre-export review and blocking checks |
| `generate_json` | Export World Book JSON, character card JSON, or both |
| `query_json` | Query exported JSON |
| `share_slice` / `use_shared` / `list_shared` | Share and reuse entry/assets slices |

### Draft Types

Current `draft_type` values are limited to four kinds:

- `entry` — World Book entry.
- `mvu` — Per-project singleton MVU ZOD / initvar / update_rules / regex settings slice, id normalized to `mvu`.
- `html` — Per-project singleton HTML status bar and global regex configuration slice, id normalized to `html`.
- `ejs` — EJS dynamic entry.

Legacy-name mapping is documented in `skill/world-book-mcp-skill/references/tool-reference.md`.

### MVU Variable Tools

| Tool | Purpose |
|------|---------|
| `list_mvu_variables` | List variables in the schema |
| `upsert_mvu_variable` | Add or modify a variable |
| `remove_mvu_variable` | Remove a variable |
| `rewrite_mvu_variables` | Batch rewrite variables |

### Review & Lint Tools

| Tool | Purpose |
|------|---------|
| `lint_worldbook_content` | Run forbidden-word/specificity lint on text |
| `lint_project_content` | Run lint on the entire project |
| `create_writing_optimization_report` | Generate a writing optimization report |

## Modifying Existing JSON

```text
init_project(scan_existing=true, import_strategy="auto", if_exists="return_existing")
→ list_draft_slices / get_project / get_draft_slice
→ update_plan
→ update_character_profile / update_character_greetings / update_draft_field(s)
→ validate_draft
→ review_project / check_delivery
→ generate_json(overwrite=true)
```

## Logs

MCP silently records tool-call summaries in:

```text
.worldbook/logs/latest.jsonl
.worldbook/logs/<session>.jsonl
```

Long text fields are summarized with preview, length, and hash.

## Development

```bash
npm install
npm run typecheck
npm test
```
