# world-book-mcp

`world-book-mcp` 是一个 MCP server，用于创建、修改、校验、修复并导出 SillyTavern 世界书 JSON 与 `chara_card_v3` 角色卡 JSON。

## v5 架构

v5 使用确定性的轻量工作流：

```text
AI 询问用户需求
→ 直接记录到 plan.md
→ 基于 plan.md 生成/维护 draft YAML 配置
→ 长文本写入 source files
→ MCP 校验项目
→ MCP 根据 draft + source 生成酒馆 JSON
```

核心模型：

```text
workspace + plan.md + draft YAML + source files + deterministic builder
```

铁律：

- `plan.md` 是唯一计划文档，不引入 `plan.yaml`。
- 角色卡 `description` 必须始终是空字符串。
- 角色设定、人设、背景、关系、性格必须进入世界书条目，不写入 card description。
- 最终 `.card.json` / `.worldbook.json` 只能由 `generate_json` 生成，不直接手写。

## Workspace 结构

`init_project` 创建 v5 workspace project：

```text
.worldbook/
  workspace.yaml
  projects/
    <slug>/
      project.yaml
      plan.md
      draft/
        card.yaml
        worldbook.yaml
        assets.yaml
      source/
        fields/
          first_mes.md
          greeting-01.md
        entries/
          001-world-summary.xyaml
          010-character-basic.xyaml
        mvu/
          schema.js
          initvar.yaml
          update-rules.yaml
          variable-list.md
          output-format.md
        html/
          statusbar.html
          statusbar.css
        regex/
          scripts.yaml
        ejs/
          controller.ejs
      reports/
        validation-report.md
        build-report.yaml
      exports/
        <name>.card.json
        <name>.worldbook.json
```

## Draft YAML

### `draft/card.yaml`

角色卡元信息与字段引用。`description` 严格为空。

```yaml
name: 示例卡片
description: ""
personality: ""
scenario: ""
first_mes: ../source/fields/first_mes.md
alternate_greetings:
  - ../source/fields/greeting-01.md
mes_example: ""
creator_notes: ""
system_prompt: ""
post_history_instructions: ""
creator: ""
character_version: "1.0"
talkativeness: "0.5"
fav: false
worldbook:
  include: true
  name: 示例卡片
```

### `draft/worldbook.yaml`

世界书条目配置。正文内容放在 `source/entries/*`。

```yaml
name: 示例卡片
entries:
  - id: world-summary
    comment: 世界观总纲
    type: world_summary
    content: ../source/entries/001-world-summary.xyaml
    enabled: true
    constant: true
    keys: []
    secondary_keys: []
    position: before_char
    order: 1
    depth: 4
    scanDepth: null
    preventRecursion: true
    excludeRecursion: true
```

### `draft/assets.yaml`

可选 MVU / HTML / regex / EJS 资产配置。

```yaml
mvu:
  enabled: true
  schema: ../source/mvu/schema.js
  initvar: ../source/mvu/initvar.yaml
  updateRules: ../source/mvu/update-rules.yaml
  variableList: ../source/mvu/variable-list.md
  outputFormat: ../source/mvu/output-format.md
  variableListPath: stat_data
  hideRegex: true
  beautifyRegex: true
html:
  statusbar:
    enabled: true
    html: ../source/html/statusbar.html
    css: ../source/html/statusbar.css
    variablePaths:
      - stat_data.角色A.好感度
    hideRegex: true
regex:
  scripts: ../source/regex/scripts.yaml
ejs:
  enabled: false
  entries: []
```

## 职责边界

MCP 只做客观、确定性的 workspace/draft/source/JSON 操作：路径安全、schema 校验、导入、修复、生成和结构模板。角色调色盘、世界观构思、禁词/白描/文风判断属于 Skill 的主观创作流程；Skill 完成审查后通过 `write_source_file`、`write_draft`、`configure_draft` 落盘。

## MCP 工具

| 工具 | 用途 |
|------|------|
| `init_project` | 创建 v5 workspace project、`plan.md`、draft YAML、source/reports/exports 目录。 |
| `update_plan` | 修改 `plan.md` 的 section、决策、todo、验收标准、验证记录和风险。 |
| `write_source_file` | 只能写项目 `source/` 下文件。 |
| `read_source_file` | 安全读取项目 `source/` 下文件，供 Skill 主观审查。 |
| `write_draft` | rewrite/patch `draft/card.yaml`、`draft/worldbook.yaml`、`draft/assets.yaml`，或追加/删除世界书条目。 |
| `configure_draft` | 根据条目类型、profile、typeLists、strategyThresholds、partOrder 推导世界书条目配置，可预览或应用；拒绝重复 id 和非 `source/entries` content 引用。 |
| `query_project` | 查看项目元数据、plan、draft、source 文件、reports 与 exports。 |
| `resume_project` | 汇总断点续写状态、plan/draft 差异、MVU/EJS/exports 进度与下一步。 |
| `check_delivery` | 检查交付门禁：validation、exports、reports、entry status。 |
| `validate_project` | 校验 workspace/project 一致性、项目文件、draft/source 引用、角色卡规则、世界书条目与资产一致性。 |
| `validate_mvu` | 对 MVU schema/initvar/变量列表/output format 做静态一致性检查，包含简单 Zod schema 与 initvar 对照。 |
| `apply_mvu_preset` | 写入 v5 原生 MVU 五件套模板并启用 assets.mvu。 |
| `list_mvu_variables` | 从 initvar/schema/变量列表中列出 MVU 变量。 |
| `upsert_mvu_variable` | 新增或更新单个 MVU 变量，并同步 schema/initvar/变量列表/update rules/output format。 |
| `remove_mvu_variable` | 删除单个 MVU 变量并同步五件套。 |
| `rewrite_mvu_variables` | 使用完整变量列表重写 MVU 五件套。 |
| `repair_project` | 修复导入旧卡常见问题：非空 description、缺双递归、裸状态宏、MVU 根层级错误等。 |
| `generate_json` | 生成最终酒馆 `.card.json` 和/或 `.worldbook.json`，并生成 build report。 |
| `import_existing_json` | 将已有 Tavern 角色卡或世界书 JSON 导入为 v5 project。 |
| `import_nova_config` | 将 nova-creator-cli 风格 YAML config 导入为 v5 project。 |
| `update_entry_status` | 更新世界书条目的 status、abstract、sourceRefs、part、scope。 |
| `query_entries` | 查询世界书条目的断点续写视图与统计。 |
| `generate_tavern_sync_config` | 生成 nova tavern_sync 风格桥接配置到 reports。 |
| `create_ejs_stage_template` | 生成 EJS controller + disabled stage entries，用于分阶段人设。 |
| `list_projects` | 列出 workspace projects。 |

## 标准流程

```text
1. 询问并确认用户需求。
2. init_project。
3. update_plan 记录需求和决策。
4. write_source_file 写长文本内容。
5. write_draft 或 configure_draft 维护 draft YAML。
6. Skill 按 references 做主观文本审查，必要时用 write_source_file 修改 source。
7. validate_project。
8. 必要时 repair_project / validate_mvu。
9. generate_json。
9. 返回 exports 路径和 validation summary。
```

## 导入与修复

`import_existing_json` 将已有 Tavern JSON 映射到 v5：

- card fields → `draft/card.yaml` 与 `source/fields/*`。
- 非空 `description` → 世界书条目；card description 保持 `""`。
- personality / scenario / creator_notes → 世界书条目。
- character_book entries → `source/entries/*` + `draft/worldbook.yaml`。
- regex scripts → `source/regex/scripts.yaml`。
- 状态栏 regex → `source/html/statusbar.html` / `.css` + `draft/assets.yaml`。
- MVU 系统条目 → `source/mvu/*` + `draft/assets.yaml`。
- TavernHelper schema 脚本 → `source/mvu/schema.js`。

导入后如果校验发现常见可修复问题，使用 `repair_project`。

## 开发

```bash
npm install
npm run typecheck
npm run build
npm test
```
