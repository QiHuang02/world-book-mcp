# world-book-mcp

`world-book-mcp` 是一个 MCP server，用于创建、修改、校验、构建和导出 SillyTavern 世界书 JSON 与 `chara_card_v3` 角色卡 JSON。

## 架构

项目由两层组成：

```text
┌─────────────────────────────────────────────────────┐
│  Skill 层（skill/world-book-mcp-skill/）             │
│  创作方法论：世界观、角色、文风、二创提取、开场白     │
│  产出：高质量结构化语料                              │
└──────────────────────────┬──────────────────────────┘
                           │ 调用 MCP 工具写入 project/slices
┌──────────────────────────▼──────────────────────────┐
│  MCP 层（src/）                                      │
│  工程编排器：管理 v3 多项目工作区、DraftSlice、       │
│  validate/build/delivery、MVU/HTML/regex/EJS 资产    │
│  产出：可直接导入 SillyTavern 的 JSON 文件           │
└─────────────────────────────────────────────────────┘
```

## 主线工作流

```text
用户需求
→ init_project(output, source, assets?, opening?)
→ update_plan（记录需求、决策、导出目标）
→ update_character_profile / update_character_greetings（角色卡需要时）
→ create_draft_slice（entry/mvu/html/regex/ejs）
→ 语义化编辑工具（update_entry_content / update_entry_config / 资产工具）
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=...)
```

## Skill 层 — 创作方法论

`skill/world-book-mcp-skill/` 包含创作 reference 文档：

| 文档 | 内容 |
|------|------|
| `worldbuilding-methodology.md` | 世界观设计：A/B/C 类型判定、维度取舍、总纲零度写作 |
| `character-creation.md` | 角色设定：XML+YAML 结构、性格调色盘、三面性、开场白 |
| `derivative-extraction.md` | 二创提取：从小说/网络资源系统性提取角色、世界观、事件 |
| `style-extraction-guide.md` | 文风提取：分析源材料风格并转化为风格条目和规避表达条目 |
| `rephrase-guide.md` | 二次解释：作者对角色深层逻辑的注释，减少角色误读 |
| `content-rules.md` | 内容规则：具体性、第四面墙、user 边界 |
| `first-message.md` | 开场白规则：吸引力、剧情动力、互动点 |
| `composition.md` | 条目编排：蓝绿灯、position、order、DoubleCheck |
| `requirements.md` | 需求对齐：主题式提问与用户决策流程 |
| `tool-reference.md` | MCP v3 工具参数速查 |

## MCP 层 — 工程编排

### 工作区结构

`init_project` 创建 v3 多项目工作区：

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

已有 SillyTavern JSON 可通过 `import_existing_json` 导入：

- 世界书条目 → `entry` slices。
- 角色卡 profile / greetings → project metadata。
- 第三方 regex → `regex` slice。
- 导入来源记录到 project imports 与 slice origin。

### Project.kind

```text
Project.kind.output = worldbook | character_card | both
Project.kind.source = original | derivative | modify_existing | composite
Project.kind.assets = mvu | html | regex | ejs
```

### 核心工具

| 工具 | 用途 |
|------|------|
| `init_project` | 初始化 v3 项目，记录 output/source/assets/opening |
| `import_existing_json` | 将已有 Tavern JSON 导入为 v3 slices / metadata |
| `list_projects` / `get_project` | 查询项目状态 |
| `update_plan` | 写入需求、决策、导出目标到 `plan.md` |
| `create_draft_slice` / `update_slice_metadata` | 创建和维护 DraftSlice envelope |
| `update_entry_content` / `update_entry_config` | 写世界书正文与配置 |
| `update_character_profile` / `update_character_greetings` | 更新角色卡元数据与开场白 |
| `list_mvu_variables` / `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` | MVU 变量维护 |
| `update_mvu_source` | 集中更新 MVU 源字段 |
| `update_html_statusbar` / `update_html_config` | HTML 状态栏与配置 |
| `list_regex_scripts` / `upsert_regex_script` / `update_regex_script` / `remove_regex_script` / `reorder_regex_scripts` / `move_regex_script` | regex 资产维护 |
| `update_ejs_content` / `update_ejs_config` | EJS 动态条目维护 |
| `validate_project` | 统一校验 project/plan/worldbook/character_card/opening/mvu/html/regex/ejs/assets/build/delivery/content |
| `build_assets` | 生成 build manifest、资产 JSON 与 preview exports |
| `review_project` / `check_delivery` | 交付审查与门禁检查 |
| `generate_json` | 从 fresh build preview 导出最终 JSON |
| `query_json` | 查询已导出的 JSON |
| `share_slice` / `use_shared` / `list_shared` | 共享与复用切片 |

### Draft 类型

- `entry` — 世界书条目。
- `mvu` — 每项目唯一 MVU ZOD / initvar / updateRules / outputFormat 切片，id 固定为 `mvu`。
- `html` — 每项目唯一 HTML 状态栏与 regexPolicy 切片，id 固定为 `html`。
- `regex` — 一组相关 regex scripts，script 使用稳定内部 `id` 操作。
- `ejs` — EJS 动态条目。

外层 `active` 表示是否参与 build；内层 `enabled/disabled` 表示最终 Tavern 对象启用状态。

## 修改已有 JSON

```text
init_project(output=..., source="modify_existing", opening?若角色卡)
→ import_existing_json(path? 多候选时指定)
→ list_draft_slices / get_project / get_draft_slice
→ update_plan
→ 语义化编辑工具
→ validate_project(scope="all")
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., overwrite=true)
```

## 日志

MCP 静默记录工具调用摘要：

```text
.worldbook/logs/latest.jsonl
.worldbook/logs/<session>.jsonl
```

长文本字段以 preview + length + hash 形式记录。

## 开发

```bash
npm install
npm run typecheck
npm run build
npm test
```
