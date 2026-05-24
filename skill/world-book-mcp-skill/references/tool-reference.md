# MCP 工具参数与产物速查

本表只列宿主 AI 调用 world-book-mcp 工具时最常用错的参数和产物路径，避免凭 token 名猜参数。详细行为请参考主 SKILL.md 与各 references 文档。

## init_project

```text
init_project(name, kind="worldbook"|"character_card"|"mixed", scan_existing=true, import_strategy="auto"|"ask"|"none", if_exists="error"|"return_existing"|"overwrite")
```

产物：

- `output/projects/<id>/project.json`：项目元数据
- `output/projects/<id>/.worldbook/plan.md`：plan 文档（创作主线）
- `output/projects/<id>/.worldbook/draft/<draft_type>/<id>.json`：draft 切片
- 若 `scan_existing=true`，会自动切片 `.worldbook/imported/` 下的旧 JSON

## update_plan

`mode` 决定写入方式：

- `replace_section`：替换某个段落，需 `section`
- `append_decision`：追加一条用户决策
- `append_note`：追加备注
- `set_export_target`：设置 `export_target`，需 `export_target` 对象（含 `type`）
- `rewrite`：整篇覆盖，需 `content`

## create_draft_slice / update_draft_field(s)

`draft_type` 取值：

- `worldbook_entry`、`character_profile`、`character_greetings`
- `mvu_schema`、`mvu_update_rules`、`html_statusbar`、`html_regex`、`ejs_entry`
- `style_profile`、`chapter_outline`

`update_draft_field` 的 `field_path` 只支持**顶层字段名**（不支持嵌套点路径），例如：

| draft_type | field_path 示例 |
|---|---|
| `worldbook_entry` | `keys`、`content`、`position`、`order`、`scanDepth`、`secondaryKeys`、`comment`、`entryType`、`constant`、`enabled` |
| `character_profile` | `name`、`first_mes`、`description`、`personality`、`scenario`、`tags`、`include_worldbook`、`worldbook_name` |
| `character_greetings` | `first_mes`、`alternate_greetings` |
| `mvu_schema` | `enabled`、`output_format`、`variable_list_path`（注意：`schema_script` 由 `upsert_mvu_variable` / `rewrite_mvu_variables` 管理，不可直接编辑） |
| `mvu_update_rules` | `enabled`、`hide_regex`、`beautify_regex`（注意：`initvar`、`update_rules` 由 MVU variable tools 管理） |
| `html_statusbar` | `html`、`target`、`theme`、`hide_regex`、`enabled` |
| `html_regex` | `findRegex`、`replaceString`、`placement`、`disabled`、`name` |
| `ejs_entry` | `content`、`role`、`variable_paths`、`enabled`、`constant`、`order`、`keys`、`name` |

`update_draft_fields` 接收 `changes` 对象，键为同样的 `field_path`，可一次写多字段。

## validate_draft

```text
validate_draft(project_id, scope="all"|"plan"|"worldbook"|"character_card"|"mvu"|"ejs"|"html"|"assets"|"content"|"delivery"|"style"|"chapter")
```

每个 scope 实际产出的 section keys：

| scope | sections 输出 |
|---|---|
| `all` | plan、pending_decisions、worldbook、character_card、mvu、ejs、html、content_lint、writing_optimization、assets、style、chapter |
| `plan` | plan、pending_decisions |
| `worldbook` | worldbook |
| `character_card` | character_card |
| `mvu` | mvu |
| `ejs` | ejs |
| `html` | html |
| `assets` | assets |
| `content` | content_lint、writing_optimization（注意：没有 `content` key） |
| `delivery` | plan、pending_decisions、worldbook、character_card、mvu、ejs、html、content_lint、writing_optimization |
| `style` | style |
| `chapter` | chapter |

报告格式：

```text
{
  ok, ready_to_export, scope_used,
  sections: { <key>: { ok, errors, warnings, infos, summary } },
  recommendations
}
```

## review_project / check_delivery

- `review_project(project_id)` 等价 `validate_draft(scope="all")`，输出统一 report。
- `check_delivery(project_id, export_target="worldbook"|"character_card")` 在 review 之上加交付清单与 blocking 升级。pending_decisions 在交付期会从 warning 升为 blocking。

## generate_json

```text
generate_json(project_id, target="worldbook"|"character_card"|"both", output_path?, overwrite=false, force=false)
```

- 默认会先运行 delivery gate（即 `check_delivery`）；存在 blocking 时拒绝导出。
- 只有用户明确要求强制导出时才可传 `force=true`，skill 默认不得自动加 force。
- `target` 缺省时使用 `plan.output_target`；都没有时报错。
- `output_path` 缺省走 `output/exports/` 或导入时记录的原始路径。

## query_json

```text
query_json(path, mode="summary"|"worldbook_entries"|"greetings"|"search"|"uid"|"stats", query?, uid?)
```

- `summary`、`worldbook_entries`、`greetings` 走角色卡 JSON。
- `search`、`uid`、`stats` 走世界书 JSON。

## MVU 变量编辑

`upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` / `list_mvu_variables` 都返回 `next_tools`：

```text
["validate_draft(scope='mvu')", "build_assets(target='mvu')"]
```

写完变量后建议立刻按这个顺序跑。
