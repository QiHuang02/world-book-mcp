# world-book-mcp

An MCP server for creating, modifying, validating, building, and exporting SillyTavern World Book JSON and `chara_card_v3` character card JSON.

## Architecture

The project has two layers:

```text
┌─────────────────────────────────────────────────────────┐
│  Skill Layer (skill/world-book-mcp-skill/)              │
│  Creative methodology: worldbuilding, character design, │
│  style extraction, derivative extraction, first message │
│  Output: high-quality structured content                │
└────────────────────────────┬────────────────────────────┘
                             │ Calls MCP tools to write project/slices
┌────────────────────────────▼────────────────────────────┐
│  MCP Layer (src/)                                       │
│  Engineering orchestration: v3 workspace, DraftSlice,   │
│  validation/build/delivery, MVU/HTML/regex/EJS assets   │
│  Output: ready-to-import SillyTavern JSON files         │
└─────────────────────────────────────────────────────────┘
```

## Main Workflow

```text
User request
→ init_project(output, source, assets?, opening?)
→ update_plan (requirements, decisions, export target)
→ update_character_profile / update_character_greetings (for character cards)
→ create_draft_slice (entry/mvu/html/regex/ejs)
→ semantic editors (update_entry_content / update_entry_config / asset tools)
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

## Skill Layer — Creative Methodology

`skill/world-book-mcp-skill/` contains creation references:

| Document | Content |
|----------|---------|
| `worldbuilding-methodology.md` | World design: A/B/C type classification, dimension selection, zero-degree writing |
| `character-creation.md` | Character design: XML+YAML structure, personality palette, tri-faceted method |
| `derivative-extraction.md` | Derivative extraction from novels/web resources |
| `style-extraction-guide.md` | Style extraction and expression-avoidance entries |
| `rephrase-guide.md` | Deep character annotations to reduce misinterpretation |
| `content-rules.md` | Specificity, fourth-wall, and user-boundary rules |
| `first-message.md` | First-message hooks, plot momentum, interaction points |
| `composition.md` | Entry composition: blue/green light, position, order, DoubleCheck |
| `requirements.md` | Requirement alignment and user decision flow |
| `tool-reference.md` | MCP v3 tool parameter reference |

## MCP Layer — Engineering Orchestration

### Workspace Structure

`init_project` creates a v3 multi-project workspace:

```text
.worldbook/
  workspace.json
  projects/
    <slug>/
      project.json
      plan.md
      slices/
        entries/*.json        # draft_type="entry"
        assets/mvu.json       # draft_type="mvu"
        assets/html.json      # draft_type="html"
        assets/regex/*.json   # draft_type="regex"
        assets/ejs/*.json     # draft_type="ejs"
      build/
        runs/<build_id>/
          manifest.json
          assets/*.json
          exports/*.preview.json
          export-records/*.json
      backups/
      logs/
  shared/
    entries/*.json
    assets/*.json
    registry.json
  logs/
    latest.jsonl
    <session>.jsonl
```

Existing SillyTavern JSON can be imported with `import_existing_json`:

- World Book entries → `entry` slices.
- Character card profile / greetings → project metadata.
- Third-party regex → `regex` slices.
- Source data is recorded in project imports and slice origins.

### Project.kind

```text
Project.kind.output = worldbook | character_card | both
Project.kind.source = original | derivative | modify_existing | composite
Project.kind.assets = mvu | html | regex | ejs
```

### Core Tools

| Tool | Purpose |
|------|---------|
| `init_project` | Initialize a v3 project with output/source/assets/opening |
| `import_existing_json` | Import existing Tavern JSON into v3 slices / metadata |
| `list_projects` / `get_project` | Inspect project state |
| `update_plan` | Write requirements, decisions, and export targets to `plan.md` |
| `create_draft_slice` / `update_slice_metadata` | Create and maintain DraftSlice envelopes |
| `update_entry_content` / `update_entry_config` | Update World Book entry content and config |
| `update_character_profile` / `update_character_greetings` | Update character-card metadata and greetings |
| `list_mvu_variables` / `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` | Maintain MVU variables |
| `update_mvu_source` | Update MVU source fields as a coordinated edit |
| `update_html_statusbar` / `update_html_config` | Maintain HTML statusbar and config |
| `list_regex_scripts` / `upsert_regex_script` / `update_regex_script` / `remove_regex_script` / `reorder_regex_scripts` / `move_regex_script` | Maintain regex assets |
| `update_ejs_content` / `update_ejs_config` | Maintain EJS dynamic entries |
| `validate_project` | Validate project/plan/worldbook/character_card/opening/mvu/html/regex/ejs/assets/build/delivery/content |
| `build_assets` | Create build manifest, asset JSON, and preview exports |
| `review_project` / `check_delivery` | Review delivery readiness |
| `generate_json` | Export final JSON from a fresh build preview |
| `query_json` | Query exported JSON |
| `share_slice` / `use_shared` / `list_shared` | Share and reuse slices |

### Draft Types

- `entry` — World Book entry.
- `mvu` — Per-project singleton MVU ZOD / initvar / updateRules / outputFormat slice, id fixed to `mvu`.
- `html` — Per-project singleton HTML statusbar and regexPolicy slice, id fixed to `html`.
- `regex` — A group of related regex scripts; scripts use stable internal `id` values.
- `ejs` — EJS dynamic entry.

The slice-level `active` flag controls build participation. Inner `enabled/disabled` fields control the final Tavern object state.

## Modifying Existing JSON

```text
init_project(output=..., source="modify_existing", opening? if character card)
→ import_existing_json(path? when multiple candidates exist)
→ list_draft_slices / get_project / get_draft_slice
→ update_plan
→ semantic editors
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., overwrite=true)
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
npm run build
npm test
```
