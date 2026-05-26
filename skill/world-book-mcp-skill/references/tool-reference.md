# MCP 工具参数与产物速查

本表只列宿主 AI 调用 world-book-mcp 工具时最常用错的参数和产物路径。当前 MCP 层采用 **v2 多项目工作区 + 简化 draft 切片**；MCP 只保留结构、协议、资产和导出安全能力。内容审美、八股禁词、文风/世界观/二创提取方法论均由 skill 文档执行。

## init_project

```text
init_project(name, kind="worldbook"|"character_card"|"mixed", project_id?, scan_existing=true, import_strategy="auto"|"ask"|"none", if_exists="error"|"return_existing"|"overwrite")
```

产物：

- `.worldbook/workspace.json`：多项目索引。
- `.worldbook/projects/<slug>/project.json`：项目元数据（profile/greetings/imports 等）。
- `.worldbook/projects/<slug>/plan.md`：创作规划与用户决策。
- `.worldbook/projects/<slug>/slices/entries/*.json`：世界书 `entry` 切片。
- `.worldbook/projects/<slug>/slices/assets/*.json`：`mvu`、`html`、`ejs` 资产切片。
- `.worldbook/shared/{entries,assets}`：可复用共享切片。
- `.worldbook/logs/*.jsonl`：静默工具调用日志。

`scan_existing=true + import_strategy="auto"` 会扫描当前工作目录下已有 SillyTavern JSON：世界书条目导入为 `entry` slices；角色卡 profile/greetings 写入 project 元数据；MVU/HTML/EJS 第三方资产导入为 `mvu/html/ejs` slices。

## update_plan

`mode` 决定写入方式：

- `replace_section`：替换某个段落，需 `section` + `content`。
- `append_decision`：追加用户决策，需 `decision`。
- `append_note`：追加备注，需 `section` + `content`。
- `set_export_target`：设置导出目标，需 `export_target.type`，可带 `filename`、`strict_review`。
- `rewrite`：整篇覆盖，需 `content`。

`plan.md` 是 MCP 化的“创作规划.yaml”：输出目标、条目规划、用户决策、未决问题、MVU/EJS/HTML 需求都必须记录在这里。

## 角色卡元数据

角色卡 profile/greetings 不再是 draft slice，而是 project 元数据：

```text
update_character_profile(project_id, changes, expected_revision?)
update_character_greetings(project_id, changes, expected_revision?)
```

常用 `changes`：

- profile：`name`、`description`、`personality`、`scenario`、`tags`、`creator_notes`、`system_prompt`、`post_history_instructions`、`creator`、`character_version`、`talkativeness`、`include_worldbook`、`worldbook_name`。
- greetings：`first_mes`、`alternate_greetings`。

规范：`description` 默认留空；复杂角色信息进入 `entry` 世界书条目。更新后运行 `validate_draft(scope="character_card")`。

## create_draft_slice / update_draft_field(s)

当前 `draft_type` 仅支持：

| draft_type | 含义 | id 规则 |
|---|---|---|
| `entry` | 世界书条目 | 自定义 |
| `mvu` | MVU ZOD / initvar / update_rules / regex 开关 | 单例，id 固定为 `mvu`；传其他 id 也会规范化 |
| `html` | HTML 状态栏与全局 regex 配置 | 单例，id 固定为 `html`；传其他 id 也会规范化 |
| `ejs` | EJS 动态条目 | 自定义 |

`update_draft_field` 支持顶层字段，也支持点路径嵌套字段（如 `statusbar.html`、`global.regex_scripts`）。`update_draft_fields` 的 `changes` 对象可一次写多字段。

常用 `field_path`：

| draft_type | field_path 示例 |
|---|---|
| `entry` | `keys`、`content`、`position`、`order`、`scanDepth`、`secondaryKeys`、`comment`、`entryType`、`characterName`、`constant`、`enabled`、`preventRecursion`、`excludeRecursion` |
| `mvu` | `enabled`、`schema_script`、`initvar`、`update_rules`、`output_format`、`variable_list_path`、`hide_regex`、`beautify_regex` |
| `html` | `enabled`、`target`、`theme`、`statusbar.enabled`、`statusbar.html`、`statusbar.hide_regex`、`global.enabled`、`global.regex_scripts` |
| `ejs` | `name`、`role`、`content`、`variable_paths`、`template_type`、`stages`、`enabled`、`constant`、`position`、`order`、`keys`、`scanDepth` |

旧名映射：

| 旧 skill 名 | 当前 MCP 做法 |
|---|---|
| `worldbook_entry` | `draft_type="entry"` |
| `character_profile` | `update_character_profile` |
| `character_greetings` | `update_character_greetings` |
| `mvu_schema` + `mvu_update_rules` | `draft_type="mvu"` 单例，或 MVU variable tools |
| `html_statusbar` + `html_regex` | `draft_type="html"` 单例，写 `statusbar.*` / `global.regex_scripts` |
| `ejs_entry` | `draft_type="ejs"` |
| `style_profile` / `chapter_outline` | 不再是 MCP 工具；按 skill 文档手工分析后写为 `entry` slices 或 plan 内容 |

## MVU 变量编辑

```text
list_mvu_variables(project_id)
upsert_mvu_variable(project_id, path, kind, default_value?, update_rule?, ...)
remove_mvu_variable(project_id, path)
rewrite_mvu_variables(project_id, variables)
```

变量级修改优先用这些工具，不要手写整段 `schema_script/initvar/update_rules` 覆盖。写完后固定：

```text
validate_draft(scope="mvu")
build_assets(target="mvu")
```

## validate_draft

```text
validate_draft(project_id, scope="all"|"plan"|"worldbook"|"character_card"|"mvu"|"ejs"|"html"|"assets"|"content"|"delivery"|"style"|"chapter", strict=false)
```

每个 scope 实际产出的 section keys：

| scope | sections 输出 |
|---|---|
| `all` | plan、pending_decisions、worldbook、character_card、mvu、ejs、html、assets、style、chapter |
| `plan` | plan、pending_decisions |
| `worldbook` | worldbook |
| `character_card` | character_card |
| `mvu` | mvu |
| `ejs` | ejs |
| `html` | html |
| `assets` | assets |
| `content` | content_policy_delegated（兼容旧调用；MCP 不做内容审美/禁词判断） |
| `delivery` | plan、pending_decisions、worldbook、character_card、mvu、ejs、html |
| `style` | style（delegated info） |
| `chapter` | chapter（delegated info） |

报告格式：

```text
{ ok, ready_to_export, scope_used, sections: { <key>: { ok, errors, warnings, infos, summary } }, recommendations }
```

## build_assets

```text
build_assets(project_id, target="mvu"|"html"|"ejs"|"all")
```

用于预览将合并到角色卡的 MVU/EJS/HTML 世界书条目、regex scripts、tavern_helper scripts。局部资产修改后必须跑对应 target。

## review_project / check_delivery

- `review_project(project_id)`：最终结构审查报告。
- `check_delivery(project_id, export_target="worldbook"|"character_card")`：在 review 之上加交付清单与 blocking 升级；pending decisions 在交付期会阻塞。

这两个工具不再包含内容禁词、写作优化、文风审美或世界观方法论检查。

## generate_json

```text
generate_json(project_id, target="worldbook"|"character_card"|"both", output_path?, overwrite=false, strict_review?, force=false)
```

- 默认先运行 delivery gate；存在 blocking 时拒绝导出。
- 只有用户明确要求强制导出时才可传 `force=true`。
- `target` 缺省时使用 `plan.output_target`；二者都没有时报错。
- `output_path` 缺省时写到导出目录；修改导入 JSON 时可复用导入路径。

## query_json

```text
query_json(path, mode="summary"|"worldbook_entries"|"greetings"|"search"|"uid"|"stats", query?, uid?)
```

- `summary`、`worldbook_entries`、`greetings` 走角色卡 JSON。
- `search`、`uid`、`stats` 走世界书 JSON。

## shared slices

```text
share_slice(project_id, draft_type, id, shared_id?, title?, overwrite=false)
use_shared(project_id, shared_id, target_id?, overwrite=false)
list_shared(draft_type?, category="entries"|"assets", include_content=false)
```

`entry` 共享到 `shared/entries`；`mvu/html/ejs` 共享到 `shared/assets`。`mvu/html` 使用项目单例 id。

## 已迁移到 skill 的旧工具/能力

以下不再由 MCP 注册，也不应出现在 `src` 业务逻辑中：

- `lint_worldbook_content`
- `lint_project_content`
- `create_writing_optimization_report`
- `create_extraction_outline`
- `create_derivative_extraction_template`
- `submit_derivative_extraction_outline`
- `create_worldbuilding_outline`
- `create_worldbuilding_design_template`
- `create_style_extraction_template`
- `submit_style_profile`
- `build_style_worldbook_entries`
- `create_chapter_extraction_template`
- `build_chapter_worldbook_entries`

对应工作现在按 skill 文档分析，然后通过 `update_plan`、`create_draft_slice(draft_type="entry")` 和 `update_draft_field(s)` 写入项目。
