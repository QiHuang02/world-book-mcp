# MCP v3 工具速查

## init_project

```text
init_project(name, output, source, assets?, opening?, project_id?, scan_existing?, import_strategy?, if_exists="error"|"overwrite")
```

- `output`: `worldbook | character_card | both`
- `source`: `original | derivative | modify_existing | composite`
- `assets`: `{ mvu?, html?, regex?, ejs? }`，只表示 planned，不自动创建 slice。
- `opening`: output 包含 `character_card` 时必填。
- `source=modify_existing` 时必须导入已有 JSON；多候选时使用 `import_existing_json(path=...)`。

## update_plan

`update_plan` 同时负责 plan 和 decision：

```text
rewrite | replace_section | append_note | append_decision | set_export_target
request_decision | record_decision | list_decisions | clear_decision
```

不再使用独立 decision tools。

## DraftSlice

```text
create_draft_slice(project_id, draft_type, id?, title?, active?, source?, origin?, data?, preset?, if_exists?)
```

| draft_type | 数量规则 | id |
|---|---|---|
| `entry` | 多个 | 自定义 |
| `mvu` | 单例 | `mvu` |
| `html` | 单例 | `html` |
| `regex` | 多个 | 自定义 |
| `ejs` | 多个 | 自定义 |

外层 `active` 表示是否参与 build。内层 `enabled/disabled` 表示最终 Tavern 对象启用状态。

## 语义化编辑工具

| 目标 | 工具 |
|---|---|
| slice metadata | `update_slice_metadata` |
| entry 正文 | `update_entry_content` |
| entry 配置 | `update_entry_config` |
| profile | `update_character_profile` |
| greetings | `update_character_greetings` |
| MVU 变量 | `list_mvu_variables` / `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` |
| MVU 源 | `update_mvu_source` |
| HTML 正文 | `update_html_statusbar` |
| HTML 配置 | `update_html_config` |
| regex | `list_regex_scripts` / `upsert_regex_script` / `update_regex_script` / `remove_regex_script` / `reorder_regex_scripts` / `move_regex_script` |
| EJS 正文 | `update_ejs_content` |
| EJS 配置 | `update_ejs_config` |

条目正文、配置、资产源码和元数据分别使用上表中的语义化工具维护。

## regex

- regex 是一级资产，使用 `draft_type="regex"`。
- 一个 regex slice 包含一组 scripts。
- script 必须用稳定 `id` 操作。
- `upsert_regex_script` 是创建/完整替换主入口。
- `update_regex_script` 只做局部修改，不改 `id/source/origin`。

## MVU

MVU 变量工具传相对 `variableListPath` 的路径：

```text
upsert_mvu_variable(path=["角色A", "好感度"])
```

HTML/EJS 引用时使用完整路径：

```text
stat_data.角色A.好感度
```

默认同步：`schemaScript / initvar / updateRules`；`outputFormat` 默认不自动重写。

## validate_project

```text
validate_project(project_id, scope?, build_id?, build_policy?, strict_review?)
```

scope：

```text
all | project | plan | worldbook | character_card | opening | mvu | html | regex | ejs | assets | build | delivery | content
```

`content` 只返回 delegated info，不参与 blocking。

## build_assets

```text
build_assets(project_id, target="mvu"|"html"|"regex"|"ejs"|"all", include_previews?, force?)
```

- 每次创建新的 `build/runs/<build_id>/`。
- `target="all"` 默认生成 preview exports。
- 不写最终交付文件。

## generate_json

```text
generate_json(project_id, target?, build_id?, rebuild?, output_path?, output_paths?, overwrite=false, force=false)
```

- 不传 `build_id` 时默认重新 full build。
- 传 `build_id` 时从该 run 的 preview export 复制最终文件。
- stale build / delivery blocking 默认拒绝导出。
- `force=true` 不能绕过路径安全、artifact 缺失或 hash mismatch。

## query_json

```text
query_json(path, mode="summary"|"worldbook_entries"|"greetings"|"search"|"uid"|"stats", query?, uid?)
```

## shared slices

```text
share_slice
use_shared
list_shared
```

v3 shared slice 保留 DraftSlice envelope；使用时 source/origin 会改为 shared。
