# 工作流

采用 YAML-first 内部存储：workspace/project/slices/shared/build metadata 都写 YAML；最终 SillyTavern 预览与交付文件仍为 JSON。

## 原创角色卡

```text
init_project(output="character_card"|"both", source="original", assets?, opening)
→ update_plan(mode="upsert_plan_item" / "append_acceptance" / "append_verification")
→ update_character_profile(description="", include_worldbook=true, ...)
→ create_draft_slice(draft_type="entry", id="char-basic")
→ update_entry_content / update_entry_config
→ update_character_greetings
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

角色卡正文建议把长设定放入世界书 entry；profile `description` 默认保持短或空，避免把大段人设塞进角色卡字段。

## 原创世界书

```text
init_project(output="worldbook", source="original")
→ update_plan
→ create_draft_slice(draft_type="entry", id="world-summary")
→ update_entry_content / update_entry_config
→ validate_project(scope="worldbook")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

## 二创 / 材料转化

```text
init_project(output=..., source="derivative", opening?若角色卡)
→ update_plan 记录来源、边界、sourceRefs
→ 按 derivative-extraction.md 提取事实
→ 创建 entry slices 并写入内容/配置
→ 如需角色卡：update_character_profile + update_character_greetings
→ validate_project(scope="all")
→ build_assets(target="all")
→ generate_json
```

原则：来源没有的不补；不把大段原文塞进 MCP。

## 修改已有 JSON

```text
init_project(output=..., source="modify_existing", scan_existing=true, import_strategy="auto")
→ 多候选时 import_existing_json(path=...)
→ list_draft_slices / get_draft_slice 定位目标
→ 语义化工具修改 project metadata 或 slices
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., overwrite=true)
```

不直接 patch 最终 JSON；覆盖导入源路径时由 generate_json 自动 backup。

## 外部清单与配置 → MCP 迁移映射

外部工作流通常是“表单生成 to-do → 写源文件/YAML config → 打包 JSON”。MCP 中对应关系如下：

| 外部材料 | MCP |
|---|---|
| `to-do.md` | `plan.md` + `update_plan` 的 plan items、acceptance、verification、risk |
| `config.example.yaml` / 作品 YAML 配置 | `project.yaml` 的 `sourceManifest`、角色卡 profile/greetings、entry slices |
| `基础模板/*.md` | skill references 中的内容模板；写入时仍通过 `update_entry_content` |
| `MVU组件包/*` | `mvu` slice + `mvu-*` 系统 entry + `html`/`ejs`/`regex` slices |
| `build-card.js` | `build_assets` + `generate_json` |
| `unpack-card.js` | `init_project(source="modify_existing")` + `import_existing_json` |
| loose source files | 只作为导入/参考材料；MCP 事实源是 project/slices YAML 与 plan |

迁移外部材料时，先把作品名、角色列表、背景、开场白、MVU 需求、导出文件名写入 plan；再按工具创建 profile、greetings、entry、mvu/html/ejs/regex slices。

## MVU 局部任务

```text
create_draft_slice(draft_type="mvu")
→ list_mvu_variables / upsert_mvu_variable / remove_mvu_variable / rewrite_mvu_variables
→ validate_project(scope="mvu")
→ build_assets(target="mvu") 或 build_assets(target="all")
```

MVU 组件顺序映射为：变量结构脚本 → initvar → updateRules → 变量列表 → outputFormat → EJS 动态内容 → HTML 状态栏。需要集中调整 runtime 字段时使用 `update_mvu_source`；`initvar/updateRules/outputFormat` 是真实 entry，正文用 `update_entry_content`，日常变量增删改优先使用 MVU 变量工具。

## HTML 局部任务

```text
create_draft_slice(draft_type="html")
→ update_html_statusbar / update_html_config
→ validate_project(scope="html")
→ build_assets(target="html") 或 build_assets(target="all")
```

通用 regex 不写进 HTML；使用 regex slice。交互式状态栏模板可能包含 `<script type="module">`，当前 MCP 默认只支持安全静态/宏展示状态栏；需要交互脚本时先记录为未来增强或用户决策。

## regex 局部任务

```text
create_draft_slice(draft_type="regex", id="...")
→ upsert_regex_script / update_regex_script / remove_regex_script
→ validate_project(scope="regex")
→ build_assets(target="regex")
```

## EJS 局部任务

```text
确认或创建 MVU
→ create_draft_slice(draft_type="ejs", id="...")
→ update_ejs_content / update_ejs_config
→ validate_project(scope="ejs")
→ build_assets(target="ejs") 或 build_assets(target="all")
```

stage 默认 `enabled=false`。

## 修复已有 MVU+HTML 角色卡

用于处理导入卡中状态栏 CDATA、裸 `{{stat_data...}}` 宏、MVU 根层级错位或旧式 updateRules：

```text
init_project(source="modify_existing")
→ import_existing_json
→ list_draft_slices / get_draft_slice
→ list_regex_scripts：检查 [界面]状态栏 replaceString 是否含 CDATA
→ get_draft_slice(draft_type="html")：检查裸 {{stat_data...}} 宏
→ get_draft_slice(draft_type="mvu")：检查 schemaScript/initvar 是否重复 stat_data 根层级
→ update_regex_script / update_html_statusbar / update_mvu_source 或 rewrite_mvu_variables
→ validate_project(scope="mvu")
→ validate_project(scope="html")
→ validate_project(scope="regex")
→ build_assets(target="all", force=true 如需避开旧 artifact 缓存)
→ generate_json(build_id=...)
```

验收项：

- 导出预览 JSON 不含 `<![CDATA[` 或 `]]>`。
- `[界面]状态栏.replaceString` 不含裸 `{{stat_data`，只使用 `{{format_message_variable::...}}`。
- `<initvar>` 内没有多余根键 `stat_data:`，除非 schema 明确也以 `stat_data` 为根且 plan 记录了原因；默认禁止。
- `target` 在 schema 与 initvar 中处于同一层级，避免 `expected object, received undefined at target`。
- `[mvu_update]变量更新规则` 顶层是 `变量更新规则:`，不是 JS 执行语句。

## 构建与导出产物

```text
build_assets(target="all")
  → build/runs/<build_id>/manifest.yaml
  → build/runs/<build_id>/assets/*.yaml
  → build/runs/<build_id>/validation-report.yaml
  → build/runs/<build_id>/delivery-checklist.yaml
  → build/runs/<build_id>/exports/*.preview.json

generate_json(build_id=...)
  → build/runs/<build_id>/export-records/<export_id>.yaml
  → 最终 .worldbook.json / .card.json
```

内部元数据是 YAML；只有 Tavern 预览和最终交付保持 JSON。

## 导出流程

```text
validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ 内容自查
→ generate_json(build_id=...)
```

存在 blocking 时默认不导出；只有用户明确要求强制导出才传 `force=true`。
