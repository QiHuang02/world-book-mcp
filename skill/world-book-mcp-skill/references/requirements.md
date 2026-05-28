# 需求对齐

## 粗略规划

用户只给一句需求时，先 `init_project`，再确认最低限度信息：输出目标、单卡/多卡/纯世界书、题材边界、是否已经明确要求 MVU/HTML/EJS、禁忌内容、导出文件名。

MVU/EJS/HTML 不主动建议；只有用户提到、现有 JSON 已包含、或任务目标无法不用它们实现时才单独确认。

## 外部清单 / 表单字段映射

从外部 `to-do.md`、HTML 表单或 YAML 配置迁移时，先把信息写入 `plan.md`，再落到 MCP project/slices：

| 外部信息 | MCP 写入 |
|---|---|
| 作品名称 | `init_project(name=...)`、`Project.name`、导出计划 |
| 角色信息 | `update_character_profile` + 角色 entry slices |
| 背景设定 | world/background/scene/faction entry slices |
| 开场白 | `opening` 设计 + `update_character_greetings` |
| 对话补充 | 可选 dialogue corpus entry，标注“仅供语料参考，不是已发生剧情” |
| 角色采访 | 可选 character interview entry，标注“仅供人设补全” |
| 玩家模板 | protagonist / `{{user}}` entry，避免限制玩家自由度 |
| MVU 需求 | `assets.mvu=true`、`create_draft_slice(draft_type="mvu")`、MVU variable tools |
| HTML 状态栏 | `assets.html=true`、`create_draft_slice(draft_type="html")` |
| 分阶段人设/动态内容 | EJS slices，必须已有 MVU |
| 导出文件名 | `update_plan(mode="set_export_target")` |

loose source files 只作为输入材料；MCP 的事实源是 `.worldbook` 下的 YAML project/slices 与 plan。

## 原创主题式提问

原创或设定不足时按主题逐轮推进，每轮只问一个主题，不把多个决策合并：

1. **输出目标**：worldbook / character_card / both。
2. **卡型范围**：单角色卡 / 多角色卡 / 群像世界书 / 纯世界书。
3. **世界观主题**：至少覆盖类型与边界、核心规则与差异、势力/社会/冲突。用户信息完整时也做一轮缺口复核。
4. **人物设定主题**：每个核心角色至少覆盖基础定位、外貌/身份特征、性格动机/关系。
5. **互动与开场主题**：user 关系、初始场景、互动氛围、开场白数量；正文中始终用 `{{user}}` 作为占位符，first_mes 至少 400 个非标点字符。
6. **可选资产主题**：MVU/EJS/HTML。启用 MVU 时必须确认变量用途、变量树、默认值、更新条件、展示范围，以及开场白时点的 initvar 初始状态；EJS 必须确认已有 MVU。

## 完整规划

完整项目应记录到 `plan.md`，并用结构化 plan item 维护执行状态：

- 来源类型：original / derivative / modify_existing / composite。
- 输出目标：worldbook / character_card / both。
- 卡型：单角色卡 / 多角色卡 / 群像世界书。
- 角色列表、称呼、关系、冲突。
- 世界观边界、地点、组织、规则。
- 资产需求：MVU、HTML 状态栏、EJS 动态条目。
- 文风与禁词。
- planned entries：条目名、类型、蓝/绿灯、keys、order、position、sourceRefs。
- 角色卡元数据：profile 字段、greetings 数量、worldbook_name。
- 未决问题与用户决策。
- implementation tasks：稳定 id、category、target、dependsOn、status。
- acceptance criteria：交付前用户可验收的完成条件。
- verification steps：validate/build/delivery/generate_json 等检查步骤。
- risks / blockers：无法确认的设定、来源不足或实现风险。

`plan.md` 是 MCP 版事实源，替代上游工作流里的 `to-do.md` / `创作规划.yaml`。写 slice 前先保证 plan 的条目规划足够明确；粗略规划允许标记“待细化”，但创作该条目前必须补齐。

## 用户决策

使用稳定 id：`output_target`、`card_type`、`world_boundary`、`character_scope`、`mvu_enabled`、`html_enabled`、`ejs_enabled`、`tone_style`、`export_filename`、`origin_type`、`worldbuilding_type`、`extraction_focus`。

流程统一走 `update_plan`：

```text
update_plan(mode="request_decision")
→ update_plan(mode="record_decision")
→ 必要时 update_plan(mode="append_decision") 补充说明
```

不确定时写 pending decision，不把猜测写进成品 project metadata 或 draft。

**交付影响**：pending decisions 会进入 `validate_project(scope="plan")` 与 delivery gate。导出前应全部解决；不要用猜测替代用户决策。

**冲突处理**：同一 id 需要重问时，先 `update_plan(mode="clear_decision")`。已记录决策和当前需求冲突时，先清除再记录新答案。

## MCP 写入对应

| 需求结果 | MCP 写入 |
|---|---|
| 角色卡 profile | `update_character_profile`，`description` 默认空或短摘要 |
| first_mes / alternate_greetings | `update_character_greetings` |
| 世界观/角色/物品/场景/事件 | `create_draft_slice(draft_type="entry")` |
| MVU 变量方案 | `create_draft_slice(draft_type="mvu", id="mvu")` 自动生成 `mvu-*` 系统 entry，再用 MVU variable tools / `update_entry_content` |
| HTML 状态栏 | `create_draft_slice(draft_type="html", id="html")` |
| 通用/第三方 regex | `create_draft_slice(draft_type="regex", id="...")` + regex tools |
| EJS 动态内容 | `create_draft_slice(draft_type="ejs")` |
| 文风画像 | 按 `style-extraction-guide.md` 分析后写入 plan 或 `entry` slices |
| 章节提取 | 按 `derivative-extraction.md` 分析后写入 plan 或 `entry` slices |

## 需求自查

- 是否已经明确输出目标和导出文件名？
- 是否已经区分原创事实、二创来源事实和原创补写？
- 是否存在 pending decisions？若有，不进入 delivery。
- 是否把 profile/greetings 与 `entry` 世界书条目分清？
- 是否把外部清单/config 中的源文件路径转换成 MCP plan/sourceManifest/slices，而不是依赖 loose files？
- 是否避免主动推销 MVU/EJS/HTML？
