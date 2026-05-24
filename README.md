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
                             │ AI calls MCP tools to write drafts
┌────────────────────────────▼────────────────────────────┐
│  MCP Layer (src/)                                       │
│  Engineering orchestrator: manages draft slices,        │
│  validates consistency, builds MVU/EJS/HTML assets,     │
│  exports SillyTavern JSON                              │
│  Output: ready-to-import SillyTavern JSON files        │
└─────────────────────────────────────────────────────────┘
```

## Main Workflow

```text
User request
→ init_project
→ update_plan (record requirements, decisions, export target)
→ create_draft_slice / update_draft_field(s) (write content)
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
| `composition.md` | Entry composition: blue/green light, position, order |
| `requirements.md` | Requirements alignment: user decision flow |
| `tool-reference.md` | MCP tool parameter quick reference |

## MCP Layer — Engineering Orchestration

### Workspace Structure

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

It scans existing SillyTavern JSON files in the current directory and slices World Book entries, character card profile, greetings, MVU, HTML, EJS, and regex assets into draft files.

### Core Tools

| Tool | Purpose |
|------|---------|
| `init_project` | Initialize `.worldbook/`, scan and slice existing Tavern JSON |
| `update_plan` | Write requirements, decisions, export target to `.worldbook/plan.md` |
| `create_draft_slice` | Create a draft slice |
| `update_draft_field` / `update_draft_fields` | Update draft fields |
| `validate_draft` | Validate World Book, character card, MVU, EJS, HTML drafts |
| `build_assets` | Preview assets that will be merged into a character card |
| `review_project` / `check_delivery` | Pre-export review and blocking checks |
| `generate_json` | Export World Book JSON, character card JSON, or both |
| `query_json` | Query exported JSON |

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

### Draft Types

- `worldbook_entry` — World Book entry
- `character_profile` — Character card profile
- `character_greetings` — First messages / alternate greetings
- `mvu_schema` — MVU ZOD schema
- `mvu_update_rules` — MVU initvar + update_rules
- `html_statusbar` — HTML status bar
- `html_regex` — HTML regex scripts
- `ejs_entry` — EJS dynamic entries
- `style_profile` — Style configuration
- `chapter_outline` — Chapter outline

## Modifying Existing JSON

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

## Development

```bash
npm install
npm run typecheck
npm test
```
