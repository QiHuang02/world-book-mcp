---
name: world-book-mcp-skill
description: Use world-book-mcp v5 to ask for user requirements, record them in plan.md, maintain draft YAML, write source files, validate, import existing Tavern JSON, and generate SillyTavern world book JSON or chara_card_v3 character card JSON. Trigger for SillyTavern, 酒馆, 世界书, 角色卡, chara_card_v3, plan.md, draft YAML, MVU, HTML状态栏, regex, EJS, import/repair existing Tavern JSON.
---

# world-book-mcp v5 操作规范

v5 采用唯一工作流：

```text
AI 询问用户需求
→ 直接记录到 plan.md
→ 基于 plan.md 生成/维护 draft YAML 配置
→ 创作长内容到 source files
→ MCP 校验
→ MCP 根据 draft + source 生成酒馆 JSON
```

核心结构是：

```text
workspace + plan.md + draft YAML + source files + deterministic builder
```

## 铁律

1. **plan**：所有需求、决策、规划、验收和验证记录都写入 `plan.md`。
2. **description 只能为空字符串**：角色卡 `description` 必须是 `""`。角色设定、人设、背景、关系、性格全部进入世界书条目。
3. **不直接手写最终 JSON**：最终 `.card.json` / `.worldbook.json` 只能由 `generate_json` 生成。
4. **draft YAML 是生成配置源**：`draft/card.yaml`、`draft/worldbook.yaml`、`draft/assets.yaml` 决定最终 JSON。
5. **长内容进 source 文件**：开场白、条目正文、MVU、HTML、regex、EJS 内容放在 `source/`。
6. **世界书条目双递归必须开启**：`preventRecursion: true` 与 `excludeRecursion: true`。
7. **绿灯条目必须有 keys**：`constant: false` 时必须配置触发词。
8. **MVU/EJS/HTML 不主动推销**：用户明确要求或需求明显需要时才启用。EJS 依赖 MVU。
9. **开场白不预设 {{user}}**：不得预设 user 的性别、外貌、行动、心理或无法确认的身份。
10. **生成前必须校验**：完整交付前先 `validate_project`，修复 blocking 后再 `generate_json`。

## 标准流程

### 原创 / 二创项目

```text
1. 逐主题询问用户需求
2. init_project
3. update_plan 写入 plan.md
4. write_source_file 写 source 内容
5. write_draft 写 draft YAML
6. validate_project
7. 修复问题
8. generate_json
9. 返回 exports 路径和 validation summary
```

### 修改已有 JSON

```text
1. import_existing_json
2. query_project 查看导入后的 plan/draft/source
3. update_plan 记录修改目标
4. write_source_file / write_draft 修改
5. validate_project
6. generate_json(overwrite=true)
7. 返回 exports 路径和 validation summary
```

导入规则：

- 角色卡字段进入 `source/fields/*` 和 `draft/card.yaml`。
- 原卡 `description` 非空时，不写回 card description；改成 worldbook entry。
- character_book entries 进入 `source/entries/*` 和 `draft/worldbook.yaml`。
- regex_scripts 进入 `source/regex/scripts.yaml` 和 `draft/assets.yaml`。
- 状态栏 regex 拆为 `source/html/statusbar.html/css` 和 `draft/assets.yaml`。
- MVU 系统条目拆为 `source/mvu/*` 和 `draft/assets.yaml`。
- TavernHelper 变量结构脚本导入为 `source/mvu/schema.js`。

## 需求询问顺序

按主题逐步问，不要一次问完所有问题：

1. 输出目标：世界书 / 角色卡 / 二者都要。
2. 来源：原创 / 二创 / 修改已有 JSON / 混合。
3. 项目名称与作品类型。
4. 世界观：世界类型、核心规则、势力/冲突、user 可感知边界。
5. 角色：每个核心角色分别确认基础定位、外貌身份特征、性格动机关系。
6. `{{user}}` 边界：不能预设的身份、外貌、行为、关系。
7. 开场白：初始场景、与 `{{user}}` 的关系、氛围、可选开场数量。
8. 可选资产：MVU、HTML 状态栏、regex、EJS。
9. 验收标准：用户希望最终 JSON 满足什么。

## v5 项目结构

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
        entries/
        mvu/
        html/
        regex/
        ejs/
      reports/
      exports/
```

## plan.md

默认结构包含：用户原始需求、项目属性、用户决策记录、世界观规划、角色规划、开场白规划、世界书条目规划、资产规划、待办、验收标准、验证记录、风险与未决问题。

使用 `update_plan` 操作：

- `replace_section`
- `append_section`
- `append_decision`
- `append_todo`
- `update_todo`
- `append_acceptance`
- `append_verification`
- `append_risk`

## draft/card.yaml 规则

```yaml
name: 角色卡名
description: ""
personality: ../source/fields/personality.md
scenario: ../source/fields/scenario.md
first_mes: ../source/fields/first_mes.md
alternate_greetings:
  - ../source/fields/greeting-01.md
mes_example: ../source/fields/mes_example.md
creator_notes: ../source/fields/creator_notes.md
system_prompt: ../source/fields/system_prompt.md
post_history_instructions: ../source/fields/post_history_instructions.md
creator: ""
character_version: "1.0"
talkativeness: "0.5"
fav: false
worldbook:
  include: true
  name: 角色卡名
```

规则：

- `description` 必须严格等于 `""`。
- 人设信息写进 `draft/worldbook.yaml` entries 引用的 source 文件。
- `first_mes` 必须存在。
- 启用 MVU/HTML 状态栏时，`first_mes` 必须包含 `<StatusPlaceHolderImpl/>`。

## draft/worldbook.yaml 规则

```yaml
name: 角色卡名
entries:
  - id: stable-id
    comment: 条目标题
    type: character_basic
    content: ../source/entries/file.xyaml
    enabled: true
    constant: true
    keys: []
    secondary_keys: []
    position: after_char
    order: 10
    depth: 4
    scanDepth: null
    preventRecursion: true
    excludeRecursion: true
```

推荐条目类型：

- `world_summary`：世界观总纲
- `background`：背景设定
- `character_basic`：角色基础信息
- `character_personality`：角色性格
- `player`：玩家角色边界
- `npc`：NPC
- `item` / `ability` / `scene` / `event` / `faction`
- `style` / `dialogue`

规则：

- 每个 entry 必须有稳定 `id`。
- `content` 路径必须存在。
- `position` 必须合法。
- `order` 必须是数字。
- `preventRecursion` 和 `excludeRecursion` 必须为 true。
- `constant: false` 的绿灯条目必须有 keys。
- 人设、世界观、物品、事件内容推荐 XML-wrapped YAML。

## draft/assets.yaml 规则

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

规则：

- EJS 依赖 MVU。
- MVU 启用时必须配置 `schema/initvar/updateRules/variableList/outputFormat`。
- MVU 以 `schema.js` 为先：数字用 `z.coerce.number()`，范围用 `_.clamp`，不导入 zod/lodash，不使用 `.strict()` / `.passthrough()`。
- `_` 前缀变量只读、`$` 前缀变量隐藏；二者不写入 AI 更新规则。
- EJS 读取 MVU 必须使用 `getvar('stat_data.xxx')`，共享变量在 `[EJS]预处理` 中用 `@@generate_before` + `define()` 注册。
- HTML 状态栏禁止 `<script>` 和外链，除非明确使用 `dynamic_js` 并记录原因。
- HTML 展示 MVU 变量必须使用 `{{format_message_variable::stat_data.xxx}}`。
- MVU `initvar` 不应额外包一层 `stat_data:`，除非 plan.md 记录原因。
- builder 会自动注入变量更新隐藏/美化 regex 与状态栏占位符隐藏/替换 regex。

## 工作方式

先按 references 完成需求澄清、创作、检查和修订；内容确认后，通过 `write_source_file`、`write_draft`、`configure_draft` 写入项目，再运行校验与生成。

## MCP 工具速查

| 工具 | 用途 |
|---|---|
| `init_project` | 创建 v5 workspace project、plan.md、draft/source/reports/exports 目录 |
| `update_plan` | 修改 plan.md 的 section、决策、todo、验收、验证记录 |
| `write_source_file` | 写入项目 source 文件，只能写 source 目录 |
| `read_source_file` | 安全读取 source 文件，便于检查和续写 |
| `write_draft` | 写入或修改 draft/card、draft/worldbook、draft/assets |
| `configure_draft` | 根据条目类型、profile、typeLists、strategyThresholds、partOrder 推导世界书条目配置，可 preview/apply；拒绝重复 id 与非 entries 引用 |
| `query_project` | 查询项目、plan、draft、source 文件、reports/exports 路径 |
| `resume_project` | 汇总断点续写状态、plan/draft 差异和下一步 |
| `check_delivery` | 检查 validation、exports、reports、entry status 等交付门禁 |
| `validate_project` | 校验 workspace/project、plan、draft/source、资产一致性 |
| `validate_mvu` | 检查 MVU schema/initvar/变量列表/output format/update rules 一致性；含简单 Zod schema 对照、Zod 反模式、沙箱 parse/幂等性、enum/阶段/地点覆盖提示 |
| `convert_mvu_path` | 在 EJS `stat_data.a.b`、AI JSON Patch `/a/b`、YAML 点路径 `a.b` 间互转 |
| `apply_mvu_preset` | 写入 v5 原生 MVU 五件套模板并启用 assets.mvu；`tavern_cards` 会额外写入变量更新美化 HTML 模板 |
| `list_mvu_variables` | 列出 MVU 变量路径、默认值和覆盖情况 |
| `upsert_mvu_variable` | 新增或更新单个 MVU 变量并同步五件套 |
| `remove_mvu_variable` | 删除单个 MVU 变量并同步五件套 |
| `rewrite_mvu_variables` | 按完整变量列表重写 MVU 五件套 |
| `repair_project` | 修复旧卡导入常见问题 |
| `generate_json` | 生成最终酒馆 JSON 和 build report |
| `import_existing_json` | 从已有角色卡/世界书 JSON 创建 v5 项目 |
| `import_nova_config` | 从 nova-creator-cli 风格 YAML config 创建 v5 项目 |
| `update_entry_status` | 更新世界书条目的 status、abstract、sourceRefs、part、scope |
| `query_entries` | 查询世界书条目的断点续写视图与统计 |
| `generate_tavern_sync_config` | 生成 nova tavern_sync 风格桥接配置 |
| `create_ejs_stage_template` | 生成 EJS controller + disabled stage entries，用于分阶段人设 |
| `list_projects` | 列出 workspace 项目 |

## References

详细规则见 `references/`：

- `workflow.md`
- `resume.md`
- `composition.md`
- `rules.md`
- `requirements.md`
- `plan-md.md`
- `draft-yaml.md`
- `entries.md`
- `character.md`：角色基础信息、调色盘、三面性、多阶段、关系画面和二次解释。
- `worldbuilding.md`：A/B/C 判定、最小设定集、概念锚点、零度总纲和世界维度拆分。
- `first-message.md`
- `mvu.md`
- `html-statusbar.md`
- `regex.md`
- `ejs.md`
- `import-repair.md`
- `validation.md`

## 内容写作约束

- 不在成品内容里写“这是角色卡/世界书/AI/模型”。
- 使用字面占位符 `{{user}}`，不要用 `<user>` 或“用户”替代。
- 角色卡围绕世界书条目组织，不把大段人设塞进角色卡字段。
- 开场白以可互动场景结尾，给 `{{user}}` 留行动空间。
- 若使用状态栏，开场白中保留 `<StatusPlaceHolderImpl/>`。

## 交付前检查

交付前必须确认：

```text
validate_project → 无 error
generate_json → 成功
reports/validation-report.md → 已生成
reports/build-report.yaml → 已生成
exports/*.json → 已生成
返回 exports 路径与 validation summary
```
