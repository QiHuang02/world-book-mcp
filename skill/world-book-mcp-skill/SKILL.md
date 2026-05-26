---
name: world-book-mcp-skill
description: Use when the user mentions SillyTavern, 世界书, 酒馆, 角色卡, chara_card_v3, world book JSON, character card JSON, MVU, HTML美化, EJS dynamic entries, or any world-book-mcp MCP tool (init_project, create_draft_slice, update_draft_field, validate_draft, generate_json, update_character_profile, update_character_greetings). Also use when asked to modify, import, or export existing Tavern world book / character card JSON files.
---

# world-book-mcp 创作项目主线

`world-book-mcp` 是 SillyTavern 世界书与 `chara_card_v3` 角色卡的底层项目编排器。MCP server 只负责需求记录、project 元数据、draft 切片、MVU/EJS/HTML 资产、结构/协议/工程安全校验和导出。所有内容审美、八股禁词、文风优化、角色辨识度、世界观方法论、二创提取策略由本 skill 执行。

## 适用判定

**适用场景：**
- 从零创建 SillyTavern 世界书或角色卡
- 修改已有世界书/角色卡 JSON
- 二创材料转化为世界书条目
- 添加或修改 MVU 变量系统、HTML 状态栏、EJS 动态条目
- 校验或导出世界书/角色卡 JSON

**不适用场景：**
- 纯内容讨论（不涉及 MCP 工具调用）— 按 `references/content-rules.md` 做内容建议即可
- 只读取 JSON 内容而不修改 — 直接用 `query_json`
- 非 SillyTavern 格式的 JSON

## 绝对主线

所有完整创建、修改、审查、导出任务默认走：

```text
init_project
→ requirements / request_user_decision / record_user_decision
→ update_plan
→ update_character_profile / update_character_greetings（角色卡需要时）
→ create_draft_slice / update_draft_field(s)
→ validate_draft(scope)
→ build_assets（有 MVU/EJS/HTML 时）
→ skill 内容自查（content-rules.md）
→ review_project
→ check_delivery
→ generate_json
```

`init_project` 是固定入口。修改已有 JSON 时也先调用 `init_project(scan_existing=true, import_strategy=”auto”)`，由 MCP 自动导入：世界书条目切为 `entry`，角色卡 profile/greetings 写入 project 元数据，MVU/HTML/EJS 资产切为 `mvu/html/ejs`。

## 当前数据模型

v2 工作区结构：

```text
.worldbook/
  workspace.json
  projects/<slug>/
    project.json
    plan.md
    slices/
      entries/*.json
      assets/*.json
  shared/{entries,assets}/
  logs/*.jsonl
```

当前 draft_type：

| draft_type | 含义 | id |
|---|---|---|
| `entry` | 世界书条目 | 自定义 |
| `mvu` | MVU 资产（单例） | `”mvu”` |
| `html` | HTML/regex 资产（单例） | `”html”` |
| `ejs` | EJS 动态条目 | 自定义 |

旧文档名映射（凭 token 名猜不准时先查 `references/tool-reference.md`）：`worldbook_entry→entry`，`character_profile→update_character_profile`，`character_greetings→update_character_greetings`，`mvu_schema/mvu_update_rules→mvu`，`html_statusbar/html_regex→html`，`ejs_entry→ejs`。

## 任务路由

按阶段×来源×范围三维路由，详见 `references/task-routing.md` 和 `references/workflows.md`。

核心规则：
- 原创角色卡：`update_character_profile(description=””)` + `update_character_greetings` + `entry` 角色条目
- 纯世界书：只创建 `entry`，仍需 plan 和导出目标
- 二创/材料转化：宿主 AI 整理来源事实和 sourceRefs，不补原文未提及内容
- 修改已有 JSON：先导入切片，只改 project 元数据或相关 draft，**绝不直接编辑最终 JSON**
- MVU/EJS/HTML 局部任务：只改对应 slice，但必须跑对应 scope 校验 + `build_assets`
- 内容审查：`validate_draft(scope=”content”)` 仅返回 delegated info；实际检查由宿主 AI 按 `references/content-rules.md` 执行

## 需求对齐

不确定的关键设定不要编造。流程：

```text
request_user_decision → record_user_decision → update_plan(mode=”append_decision”)
```

必须记录到 plan：任务类型、输出目标、卡型、是否启用 MVU/HTML/EJS、世界观边界、角色列表、用户禁忌、导出文件名、未决问题。

原创或设定不足时按主题逐轮推进：输出目标 → 卡型范围 → 世界观 → 人物设定 → 互动/开场 → 可选 MVU/EJS/HTML。每轮只问一个主题；用户信息足够时也要做缺口复核。MVU/EJS/HTML 仅在用户提及或任务明确需要时启用，不主动推销；EJS 必须依赖 MVU。

稳定决策 id 与详细流程见 `references/requirements.md`。

## draft 创作规范

`.worldbook/projects/<slug>/slices/` 是真实工作区。

- 角色卡 profile/greetings：写 project 元数据，不作为 draft slice。`description` 默认应为空。
- 世界书条目：`create_draft_slice(draft_type=”entry”, id=...)` — 建议数据库式 XML 包裹 YAML：具体、短句、可触发、可维护。
- MVU：`create_draft_slice(draft_type=”mvu”, id=”mvu”)`；变量级改动优先用 MVU variable tools。
- HTML：`create_draft_slice(draft_type=”html”, id=”html”)`；状态栏写 `statusbar.*`，全局正则写 `global.regex_scripts`。
- EJS：`create_draft_slice(draft_type=”ejs”, id=...)`；stage/helper 条目默认禁用或按需启用。

绿灯条目必须有 keys；物品/能力/场景/事件建议 `scanDepth=2`；条目默认双递归：`preventRecursion=true` 和 `excludeRecursion=true`。

条目编排详细方法论见 `references/composition.md`，角色结构见 `references/character-creation.md`，世界观见 `references/worldbuilding-methodology.md`。

## 内容规则由 skill 执行

交付前必须按 `references/content-rules.md` 检查：量子词、破折号、八股微表情、声线标签、极端情绪、廉价比喻、模糊修饰、抽象性格标签、外貌辨识度、关系证据、第四面墙、替 user 行动等。MCP 不再注册 `lint_worldbook_content`、`lint_project_content`、`create_writing_optimization_report`。

## MVU / EJS / HTML 一致性（红线）

详见 `references/assets-consistency.md`。核心红线：

- MVU 必须含 `export const Schema = z.object(...)` + `registerMvuSchema(Schema)`；schema/initvar/update_rules 路径一致
- `_` 前缀只读（AI 不得更新），`$` 前缀 hidden（不得输出或被 EJS/HTML 暴露）
- EJS 必须依赖 MVU；路径写 `stat_data.xxx`；`variable_paths` 与 `getvar(...)` 对齐 MVU schema
- `getwi(...)` 引用条目必须存在；stage 默认 `enabled=false`
- HTML 状态栏必须有 `.wbm-statusbar` 作用域，禁止全局选择器和外部 URL
- 启用 MVU 或 HTML 状态栏时，所有开场白必须含 `<StatusPlaceHolderImpl/>`

局部资产修改后固定运行：

```text
validate_draft(scope=”mvu” | “ejs” | “html”)
build_assets(target=”mvu” | “ejs” | “html” | “all”)
```

## 开场白规范

first_mes 必填。不得替 `{{user}}` / `<user>` 说话、行动、决定外貌、性别、房间、身份或后续选择。结尾应给 user 明确可行动方向。详见 `references/first-message.md`。

## 校验与交付 gate

`validate_draft` 统一返回 section 化 report。scope：`all | plan | worldbook | character_card | mvu | ejs | html | assets | content | delivery | style | chapter`（详见 `references/tool-reference.md` 的 scope→sections 映射）。

`content` / `style` / `chapter` scope 仅作兼容或 delegated 提示；不做内容质量判断。

导出前必须：

```text
review_project(project_id)
check_delivery(project_id, export_target)
generate_json(project_id, target)
```

`generate_json` 默认执行 delivery gate；存在 blocking 时拒绝导出。只有用户明确要求强制导出时才可传 `force=true`，skill 默认不得使用 force。

## 禁止事项

- 不绕过 `init_project` 开完整项目
- 不直接修改最终 JSON
- 不跳过 plan 记录用户决策
- 不把长篇原文塞进 MCP；只保存结构化提取结果和 draft
- 不把大段人设塞进 character card description
- 不让 EJS 脱离 MVU
- 不让 HTML 污染全局 CSS 或依赖外链
- 不在成品条目里写”这是角色卡/世界书/AI/模型/玩家正在使用”
- 不使用旧 draft_type 调 MCP；旧名只用于迁移映射说明
- 不调用已迁移的 MCP 工具：`lint_worldbook_content`、`lint_project_content`、`create_writing_optimization_report`、extraction/worldbuilding/style/chapter 专用工具

## 常见错误

| 错误 | 正确 |
|------|------|
| 跳过 `init_project` 直接创建 draft | 始终从 `init_project` 开始；修改已有 JSON 也用 `scan_existing=true` |
| 直接编辑导出的 JSON 文件 | 改 project metadata 或 draft slice，再重新 `generate_json` |
| 把角色性格/外貌全塞进 `description` | profile `description` 默认留空；复杂设定进 `entry` |
| `validate_draft(scope=”content”)` 不报错就当内容合格 | MCP 不做内容质量判断；宿主 AI 必须按 `content-rules.md` 人工审查 |
| 用旧 draft_type 名（`worldbook_entry`、`mvu_schema` 等）调 MCP | 使用当前名：`entry`、`mvu`、`html`、`ejs` |
| EJS 路径写 `角色A.好感度` 而不带 `stat_data.` 前缀 | 必须写完整路径：`stat_data.角色A.好感度` |
| 手写整段 schema_script 而不用 MVU variable tools | 变量级改动优先用 `upsert_mvu_variable` / `remove_mvu_variable` |
| pending decision 未解决就进入 delivery | 导出前运行 `list_user_decisions(only_pending=true)` 确认全部解决 |
| `getwi()` 引用不存在的条目 | controller 引用的 stage 条目必须已创建（即使 `enabled=false`） |
| 二创时补全原文没有的信息 | 标记 `原文未提及`，不推断不补全 |

## Red Flags — 停下来检查

出现以下想法时对照上表：

- “这个项目很简单，不用 init_project 也行”
- “我就直接改一下 JSON 文件，不改 schema”
- “content scope 过了，内容应该没问题”
- “我把性格写进 description 更省事”
- “这条目不用 keys 也能工作”
- “先跳过 plan，后面再补”
- “force=true 导出算了，blocking 不重要”
- “这个旧 draft_type 名我记得，不用查文档”

**以上所有想法都意味着：停手，回到主线流程。**

## reference 索引

| 文件 | 内容 |
|------|------|
| `tool-reference.md` | MCP 工具参数、旧名映射、field_path 速查、scope→sections 映射、共享切片 |
| `task-routing.md` | 任务路由：阶段×来源×范围三维判断、常见任务速查 |
| `workflows.md` | 各场景完整工作流（原创角色卡、纯世界书、二创、修改已有、断点续作、资产局部） |
| `requirements.md` | 需求对齐：主题式提问流程、决策 id、plan 字段、需求自查 |
| `content-rules.md` | 内容审美：禁词库、八股微表情、具体性、第四面墙、自查流程 |
| `composition.md` | 条目编排：规划表、条目创作循环、DoubleCheck、常见调整 |
| `assets-consistency.md` | MVU/EJS/HTML 一致性红线、格式规范、tavern_helper 序列化 |
| `first-message.md` | 开场白规范：禁止项、推荐模式、MVU/HTML 要求 |
| `worldbuilding-methodology.md` | 世界观设计：类型判定 A/B/C、维度取舍、总纲零度写作、条目配置 |
| `character-creation.md` | 角色设定：XML+YAML 结构、性格调色盘、三面性方法、性格独立原则 |
| `derivative-extraction.md` | 二创提取：角色维度、世界观提取、禁词剔除、sourceRefs |
| `style-extraction-guide.md` | 文风提取：采样分析、正负面规则、转化为世界书条目 |
| `rephrase-guide.md` | 二次解释：防止 AI 误解角色性格、引导用户创作 |
| `multi-stage-ejs.md` | 多阶段 EJS：controller+stage 结构、条件渲染、调色盘分阶段 |
