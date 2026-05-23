# 新主线工作流

所有完整创作、修改、导出任务固定使用：

```text
用户提出需求
→ init_project
→ update_plan
→ create_draft_slice
→ update_draft_field(s)
→ validate_draft
→ build_assets（需要预览资产时）
→ generate_json
```

## 1. init_project 固定第二步

`init_project` 会创建 `.worldbook/`、`.worldbook/plan.md`、`.worldbook/draft/`、`.worldbook/logs/`，并自动扫描当前目录已有 SillyTavern JSON。

已有第三方角色卡/世界书会被切片：

- 世界书条目 → `worldbook_entry`
- 角色卡 profile → `character_profile`
- first_mes / alternate greetings → `character_greetings`
- MVU schema / initvar / update rules → `mvu_schema` / `mvu_update_rules`
- HTML 状态栏和 regex → `html_statusbar` / `html_regex`
- EJS 条目 → `ejs_entry`

## 2. 修改已有 JSON

不再使用 import/patch/apply 流程。统一迁移为：

```text
init_project(scan_existing=true, import_strategy="auto")
→ list_draft_slices / get_draft_slice 查看切片
→ update_plan 记录修改目标
→ update_draft_field(s) 修改字段
→ validate_draft(all)
→ generate_json(overwrite=true 或输出新文件)
```

迁移关系：

| 旧心智 | 新心智 |
|---|---|
| import_worldbook_json / import_character_card_json | init_project 自动扫描切片 |
| create_*_patch | update_plan + update_draft_field(s) |
| preview_*_patch | get/list_draft_slices + validate_draft |
| apply_*_patch | generate_json |

## 3. 原创角色卡

```text
init_project
→ 询问角色、世界观、输出目标、MVU/HTML/EJS、文风
→ update_plan 写入需求和导出目标
→ create_draft_slice(character_profile)
→ create_draft_slice(character_greetings)
→ create_draft_slice(worldbook_entry...) 创建角色/背景/关系/事件条目
→ update_draft_field(s) 填写
→ validate_draft(all)
→ generate_json(character_card)
```

## 4. 根据小说/文本生成

```text
init_project
→ 宿主 AI 阅读材料并整理结构化事实
→ update_plan 记录来源、提取结果、用户选择
→ create_draft_slice 创建角色/世界观/事件/物品/文风条目
→ update_draft_field(s) 填写
→ validate_draft(all)
→ generate_json(worldbook | character_card | both)
```

不要把整篇原文塞进 MCP；原文由宿主 AI 在对话中整理。

## 5. MVU / HTML / EJS draft 化

### MVU

```text
create_draft_slice(mvu_schema)
→ update_draft_field(schema_script / variable_list_path / output_format)
→ create_draft_slice(mvu_update_rules)
→ update_draft_field(initvar / update_rules / hide_regex / beautify_regex)
→ validate_draft(mvu)
→ build_assets(mvu)
```

### HTML

```text
create_draft_slice(html_statusbar)
→ update_draft_field(html / theme / hide_regex)
→ 可选 create_draft_slice(html_regex)
→ validate_draft(html)
→ build_assets(html)
```

### EJS

```text
create_draft_slice(ejs_entry)
→ update_draft_field(content / role / keys / variable_paths)
→ validate_draft(ejs)
→ build_assets(ejs)
```

EJS 必须依赖 MVU。变量路径应以 `stat_data` 开头。

## 6. 导出

```text
validate_draft(all)
→ build_assets(all)  # 可选预览
→ generate_json(target="worldbook" | "character_card" | "both")
```

`generate_json` 从 `.worldbook/draft/` 聚合最终数据；`plan.md` 只记录意图和导出目标，不是最终数据源。
