# world-book-mcp

`world-book-mcp` 是用于创建、修改、校验并导出 SillyTavern 世界书 JSON 与 `chara_card_v3` 角色卡 JSON 的 MCP 服务器。

## 主线流程

```text
用户提出需求
→ init_project
→ update_plan
→ create_draft_slice
→ update_draft_field / update_draft_fields
→ validate_draft
→ build_assets（可选）
→ generate_json
```

## 工作区

`init_project` 会创建：

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

它会自动扫描当前目录已有 SillyTavern JSON，并切片已有世界书、角色卡 profile、greetings、MVU、HTML、EJS 与 regex 资产。

## 核心工具

| 工具 | 用途 |
|---|---|
| `init_project` | 初始化 `.worldbook/`，自动扫描并切片已有酒馆 JSON。 |
| `update_plan` | 写入 `.worldbook/plan.md`，记录需求、用户决策和导出目标。 |
| `create_draft_slice` | 创建世界书、角色卡、MVU、HTML、EJS 等 draft 切片。 |
| `update_draft_field` | 更新单个 draft 字段。 |
| `update_draft_fields` | 更新同一 draft 的多个字段。 |
| `list_draft_slices` | 列出 draft。 |
| `get_draft_slice` | 读取 draft。 |
| `delete_draft_slice` | 删除 draft。 |
| `validate_draft` | 统一校验世界书、角色卡、MVU、HTML、EJS。 |
| `build_assets` | 预览最终会合并进角色卡的世界书资产、regex、Tavern Helper、EJS 条目。 |
| `generate_json` | 导出世界书 JSON、角色卡 JSON 或两者。 |
| `query_json` | 查询导出的 JSON。 |

## draft 类型

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

## 修改已有 JSON

旧的 import/patch/apply 流程已移除。修改已有角色卡或世界书统一走：

```text
init_project(scan_existing=true, import_strategy="auto")
→ list_draft_slices / get_draft_slice
→ update_plan
→ update_draft_field(s)
→ validate_draft
→ generate_json
```

## 日志

MCP 会静默记录工具调用摘要：

```text
.worldbook/logs/latest.jsonl
.worldbook/logs/<session>.jsonl
```

长文本只记录 preview、长度和 hash。
