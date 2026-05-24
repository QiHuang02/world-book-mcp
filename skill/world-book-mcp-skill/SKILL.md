---
name: world-book-mcp-skill
description: Use the world-book-mcp MCP server to create, modify, validate, and export SillyTavern world book JSON and chara_card_v3 character card JSON through the new .worldbook/plan.md + .worldbook/draft/ workflow, including existing JSON slicing, MVU/ZOD, HTML status bars, EJS dynamic entries, and silent MCP tool logs. Invoke whenever the user mentions SillyTavern, 世界书, 酒馆, 角色卡, chara_card_v3, MVU, HTML美化, EJS, draft, plan.md, init_project, create_draft_slice, update_draft_field, validate_draft, generate_json, or modifying existing Tavern JSON.
---

# world-book-mcp 创作项目主线

`world-book-mcp` 是 SillyTavern 世界书与 `chara_card_v3` 角色卡的创作项目编排器。它不是旧式 JSON patch 工具，也不是脚本命令索引；它负责把需求、用户决策、draft 切片、MVU/EJS/HTML 资产和导出前校验串成同一条主线。

## 绝对主线

所有完整创建、修改、审查、导出任务默认走：

```text
init_project
→ requirements / request_user_decision / record_user_decision
→ update_plan
→ create_draft_slice / update_draft_field(s)
→ validate_draft(scope)
→ review_project
→ check_delivery
→ generate_json
```

`init_project` 是固定入口。修改已有 JSON 也先 `init_project(scan_existing=true, import_strategy="auto")`，由 MCP 自动切片到 `.worldbook/draft/`。

## 强制路由

- 原创角色卡：`character_profile` + `character_greetings` + 世界书条目，必要时加 MVU/HTML/EJS。
- 纯世界书：只创建 `worldbook_entry`，但仍记录 plan、需求边界和导出目标。
- 二创/材料转化：先整理来源事实和 sourceRefs，再写 draft；原文没有的不补。
- 修改已有 JSON：先导入切片，再只改相关 draft，不直接编辑最终 JSON。
- MVU/EJS/HTML 局部任务：只改对应 draft slice，但必须跑对应 scope 校验和 `build_assets`。
- 内容审查：优先 `validate_draft(scope="content")`、`review_project`、`check_delivery`。

## 需求对齐

不确定的关键设定不要编造。使用：

```text
request_user_decision → record_user_decision → update_plan(mode="append_decision")
```

必须记录到 plan：任务类型、输出目标、卡型（单角色/多角色）、是否启用 MVU/HTML/EJS、世界观边界、角色列表、用户禁忌、导出文件名、未决问题。

## draft 创作规范

`.worldbook/draft/` 是唯一真实工作区。常用切片：

- `worldbook_entry`：世界观、角色、物品、能力、场景、事件、NPC。
- `character_profile`：角色卡 profile；description 默认应为空。
- `character_greetings`：first_mes / alternate_greetings。
- `mvu_schema`、`mvu_update_rules`：MVU ZOD、initvar、update_rules。
- `html_statusbar`、`html_regex`：HTML 状态栏与正则资产。
- `ejs_entry`：controller / stage / inline / helper 动态条目。

世界书条目建议数据库式 XML 包裹 YAML：具体、短句、可触发、可维护。绿灯条目必须有 keys，物品/能力/场景/事件建议 `scanDepth=2`；条目默认双递归：`preventRecursion=true`、`excludeRecursion=true`。

## MVU / EJS / HTML 一致性

- MVU 必须使用 `export const Schema = z.object(...)` 和 `registerMvuSchema(Schema)`。
- MVU schema / initvar / update_rules 路径必须一致。
- `_` 前缀是只读变量，不得被 AI 更新；`$` 前缀是 hidden 变量，不得输出或被 EJS/HTML 暴露。
- EJS 必须依赖 MVU；路径写 `stat_data.xxx`，不得只写 `stat_data` 或 `角色A.好感度`。
- EJS 的 `variable_paths`、`getvar(...)`、`_.get(stat_data, ...)` 必须与 MVU schema 对齐。
- `getwi(...)` 引用的 stage/helper 条目必须存在；stage 默认 `enabled=false`。
- HTML 状态栏必须有 `.wbm-statusbar` 作用域，禁止 `body/html/*` 全局选择器和外部 URL。
- 启用 MVU 或 HTML 状态栏时，开场白必须包含 `<StatusPlaceHolderImpl/>`。

局部资产修改后固定运行：

```text
validate_draft(scope="mvu" | "ejs" | "html")
build_assets(target="mvu" | "ejs" | "html" | "all")
```

## 开场白规范

first_mes 必填。不得替 `{{user}}` / `<user>` 说话、行动、决定外貌、性别、房间、身份或后续选择。结尾应给 user 明确可行动方向。alternate greeting 可用 `<UpdateVariable><initvar>...</initvar></UpdateVariable>` 覆盖分支初始变量，但必须确认 YAML 可解析，并在 plan 中说明。

## 校验与交付 gate

`validate_draft` 统一返回 section 化 report。scope：

```text
all | plan | worldbook | character_card | mvu | ejs | html | assets | content | delivery | style | chapter
```

导出前必须：

```text
review_project(project_id)
check_delivery(project_id, export_target)
generate_json(project_id, target)
```

`generate_json` 默认执行 delivery gate；存在 blocking 时拒绝导出。只有用户明确要求强制导出时才可传 `force=true`，skill 默认不得使用 force。

## 禁止事项

- 不绕过 `init_project` 开完整项目。
- 不直接修改最终 JSON。
- 不跳过 plan 记录用户决策。
- 不把长篇原文塞进 MCP；只保存结构化提取结果和 draft。
- 不把大段人设塞进 character card description。
- 不让 EJS 脱离 MVU。
- 不让 HTML 污染全局 CSS 或依赖外链。
- 不在成品条目里写“这是角色卡/世界书/AI/模型/玩家正在使用”。

详见 `references/`：task-routing、requirements、composition、content-rules、first-message、assets-consistency、conversion、workflows、config-rules、tool-reference、worldbuilding-methodology、character-creation、derivative-extraction、style-extraction-guide、rephrase-guide。

`tool-reference.md` 列出每个 MCP 工具的常用参数、`field_path` 速查与各 `scope` 实际产出的 section keys，凭 token 名猜不准时优先查它。

`worldbuilding-methodology.md` 指导世界观设计：类型判定（A/B/C）、维度取舍、总纲零度写作、条目分类与蓝绿灯配置。

`character-creation.md` 指导角色人物设定：XML+YAML 结构、性格调色盘、三面性方法、性格独立原则、开场白创作。

`derivative-extraction.md` 指导二创信息提取：从小说/网络资源系统性提取角色维度、世界观、事件，标注章节行号，禁词剔除，outline 输出。

`style-extraction-guide.md` 指导文风提取：从源材料分析叙事视角、句长节奏、描写重心等维度，转化为可执行的风格条目和禁词条目。

`rephrase-guide.md` 指导二次解释：作者对角色深层逻辑的注释，防止 AI 误解角色性格，引导用户自己创作。
