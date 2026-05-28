# MCP 工具速查

内部存储使用 YAML：workspace/project/slices/shared/build metadata 都是 YAML；`generate_json` 只在最终预览和交付阶段生成 Tavern JSON。

## init_project

```text
init_project(name, output, source, assets?, opening?, project_id?, scan_existing?, import_strategy?, if_exists="error"|"overwrite")
```

- `output`: `worldbook | character_card | both`
- `source`: `original | derivative | modify_existing | composite`
- `assets`: `{ mvu?, html?, regex?, ejs? }`，只表示 planned，不自动创建 slice；真正启用 MVU 需 `create_draft_slice(draft_type="mvu")`。
- `opening`: output 包含 `character_card` 时必填。
- `source=modify_existing` 时必须导入已有 JSON；多候选时使用 `import_existing_json(path=...)`。
- 会创建 `.worldbook/workspace.yaml`、`projects/<slug>/project.yaml` 与 typed slice 目录；JSON workspace/project 不作为事实源。

## update_plan

`update_plan` 同时负责 plan、decision 和结构化计划项：

```text
rewrite | replace_section | append_note | append_decision | set_export_target
request_decision | record_decision | list_decisions | clear_decision
upsert_plan_item | update_plan_item_status | append_acceptance | append_verification
append_risk | append_checkpoint | summarize_plan
```

使用 `update_plan` 管理 decision。外部 `to-do.md` 内容应转成 plan sections、plan items、acceptance criteria 与 verification steps。

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

外层 `active` 表示是否参与 build。内层 `enabled/disabled` 表示最终 Tavern 对象启用状态。slice 文件保存在 `slices/<type>/*.yaml`。

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
- `replaceString` 是普通字符串；`[界面]状态栏` 等 HTML 替换内容禁止包含 `<![CDATA[`、`]]>` 或 `<![CDATA[]]>`。
- 修复导入卡时，如果 `replaceString` 已含 CDATA，先剥掉外壳；空 CDATA 直接重写为空字符串或标准 HTML。

## MVU

MVU 变量工具传相对 `variableListPath` 的路径：

```text
upsert_mvu_variable(path=["角色A", "好感度"])
```

HTML/EJS 引用时使用完整路径：

```text
stat_data.角色A.好感度
```

HTML 状态栏展示时要包成宏：

```text
{{format_message_variable::stat_data.角色A.好感度}}
```

默认同步：变量工具会改 `schemaScript`，并把 `initvar` / `updateRules` 写回对应真实 entry；`outputFormat` 默认不自动重写。

`update_mvu_source` 只改 MVU runtime 字段（`schemaScript`、`variableListPath`、`hideRegex`、`beautifyRegex`）。四个 MVU 系统 entry 的正文用 `update_entry_content(id="mvu-initvar"|"mvu-variable-list"|"mvu-update-rules"|"mvu-output-format")`，配置用 `update_entry_config`。

创建 `mvu` slice 时会自动创建四个系统 entry，默认 order 为 `14720~14723`，不要再复制一份普通 entry。

启用 MVU 且 schema 有变量时，`mvu-initvar` 要根据世界观、角色卡和开场白时点写出初始变量；MCP 不会替你主观生成地点、关系、资源、目标对象等剧情初始值。

集中修复导入卡 MVU 时：

- 优先使用 `list_mvu_variables`、`upsert_mvu_variable`、`rewrite_mvu_variables`，因为它们会同步 schema 和真实 entry 中的 initvar/updateRules。
- 使用 `update_mvu_source` 后，必须同时检查 `schemaScript` 以及 `mvu-initvar`、`mvu-update-rules` entry，不要只改 schema 或只改 initvar。
- `variableListPath="stat_data"` 时，schema 与 `mvu-initvar` 都应相对该根；`initvar` 不要额外包 `stat_data:`。
- `expected object, received undefined at target` 通常先查对象节点 `target` 是否在 initvar 同层存在，以及是否误多写了 `stat_data:` 根键。
- updateRules 顶层应为 `变量更新规则:` YAML，不写 `target.affection = _.clamp(...)` 这类 JS 赋值语句。
- outputFormat 默认只要求 JSONPatch `replace` / `add` / `remove`；不要写旧式 `_.set`、`delta`、`insert`、`move` 操作，除非项目明确记录了兼容原因。

## HTML 状态栏

- `update_html_statusbar` 写入状态栏 HTML 前，先把裸 `{{stat_data.xxx}}` 改成 `{{format_message_variable::stat_data.xxx}}`。
- `variablePaths` 记录完整路径，如 `stat_data.target.name`；HTML 文本中展示时才加 `format_message_variable::`。
- 状态栏 HTML 不内嵌 `<script>`、不引用外部 URL、不污染 `.wbm-statusbar` 之外的全局 CSS。
- 交互式状态栏模板可作为设计参考，但当前 MCP 默认生成安全静态/宏展示版本。

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
- 内部元数据输出为 `manifest.yaml`、`assets/*.yaml`、`validation-report.yaml`、`delivery-checklist.yaml`。

## generate_json

```text
generate_json(project_id, target?, build_id?, rebuild?, output_path?, output_paths?, overwrite=false, force=false)
```

- 不传 `build_id` 时默认重新 full build。
- 传 `build_id` 时从该 run 的 preview export 复制最终文件。
- stale build / delivery blocking 默认拒绝导出。
- `force=true` 不能绕过路径安全、artifact 缺失或 hash mismatch。
- export record 写入 `build/runs/<build_id>/export-records/<export_id>.yaml`。

## query_json

```text
query_json(path, mode="summary"|"worldbook_entries"|"greetings"|"search"|"uid"|"stats", query?, uid?)
```

只查询 Tavern JSON 文件，不用于读取内部 YAML 事实源。

## shared slices

```text
share_slice
use_shared
list_shared
```

shared slice 保留 DraftSlice envelope；registry 与 shared slice 文件均为 YAML，使用时 source/origin 会改为 shared。
