# 端到端示例：原创单角色卡

> 何时阅读：当任务被分类为 `original_character_card`、或用户描述"我想原创一个单角色卡 + 状态栏 + 变量"这类典型组合时，照这份脚本走。

本文档示范当用户提出模糊需求"我想创建一个角色卡"时，AI 如何利用 MCP 工具完成完整闭环。

所有示例 JSON 均为输入示例，输出片段只展示关键字段，省略其余字段以保持简洁。

---

## 0. 用户初始描述

```
用户：我想创建一个角色卡
```

## 1. 分类与歧义检测

AI 按 [`task-routing.md`](task-routing.md) 在 skill 内部判断：

- task_type = `original_character_card`
- 需求较模糊，需要询问 origin_type / card_type / worldbuilding_type / wants_mvu / wants_ejs / wants_html

## 2. 决策回路

对每个 `suggested_decisions[i]`，AI 依次：

### `request_user_decision`

```json
{
  "project_id": "project_xxx",
  "id": "card_type",
  "question": "请确认卡型",
  "options": [
    { "value": "single_character_card", "label": "单角色卡", "is_recommended": true },
    { "value": "multi_character_card", "label": "多角色卡" },
    { "value": "worldbook_only", "label": "纯世界书" }
  ],
  "allow_custom": false,
  "source_tool": "skill.task-routing"
}
```

将返回的问题文本展示给用户：

```
【需要用户决定】请确认卡型
可选项：
  1. [single_character_card] 单角色卡（推荐）
  2. [multi_character_card] 多角色卡
  3. [worldbook_only] 纯世界书
```

### `record_user_decision`

```json
{
  "project_id": "project_xxx",
  "id": "card_type",
  "selected_values": ["single_character_card"]
}
```

依次完成 origin_type / card_type / worldbuilding_type / wants_mvu / wants_ejs / wants_html。

最终用户答复假设：

- origin_type = original
- card_type = single_character_card
- worldbuilding_type = B_small_world
- wants_mvu = yes
- wants_ejs = no
- wants_html = yes

## 3. 世界观设计

### `create_worldbuilding_design_template`

```json
{ "world_type": "B_small_world", "title": "私立星见学园" }
```

返回必填/可选维度模板。AI 根据用户进一步对话填写具体内容后调用：

### `submit_worldbuilding_summary`

```json
{
  "project_id": "project_xxx",
  "summary": {
    "world_type": "B_small_world",
    "title": "私立星见学园",
    "summary": "封闭校园，故事围绕高二 A 班的日常与音乐部活动展开。",
    "geography": "校园内分教学楼/部活栋/食堂，外部为商店街",
    "rules": "学生必须穿校服；部活时间 16:00-18:00；",
    "boundaries": "故事范围限于校内与商店街"
  }
}
```

## 4. 卡型规划

AI 已通过用户决策确定 `card_type=single_character_card`。

### `create_worldbook_entry_plan`

```json
{
  "project_id": "project_xxx",
  "card_type": "single_character_card",
  "characters": [{ "name": "亚丝娜" }],
  "world_sections": ["世界观总纲"],
  "save": true
}
```

返回的 `entries_plan` 已经包含：

- 世界观总纲（before_char / order=1 / 蓝灯）
- 亚丝娜_基础设定（after_char / order=10 / 蓝灯）
- 亚丝娜_性格（after_char / order=30 / 蓝灯）

## 5. 起草世界书条目

### `create_character_basic_entry_template`

```json
{ "character_name": "亚丝娜" }
```

### `create_character_personality_entry_template`

```json
{ "character_name": "亚丝娜" }
```

AI 根据模板填充内容，最后调用：

### `create_worldbook_draft_entries` → `update_worldbook_draft_field`

先创建切片模板，不在一次调用中提交完整内容：

```json
{
  "project_id": "project_xxx",
  "entries": [
    { "comment": "世界观总纲", "entry_type": "world_summary" },
    { "comment": "亚丝娜_基础设定", "entry_type": "character_basic", "character_name": "亚丝娜" },
    { "comment": "亚丝娜_性格", "entry_type": "character_personality", "character_name": "亚丝娜" }
  ]
}
```

然后逐字段填充，例如：

```json
{ "project_id": "project_xxx", "comment": "亚丝娜_基础设定", "field": "keys", "value": ["亚丝娜"] }
```

```json
{ "project_id": "project_xxx", "comment": "亚丝娜_基础设定", "field": "content", "value": "<character>\nname: 亚丝娜\nidentity: 高二 A 班学生，音乐部吉他手\n</character>" }
```

导出角色卡时，`亚丝娜_基础设定` 与 `亚丝娜_性格` 会聚合成同一个内嵌世界书条目。

## 6. 角色卡

### `upsert_character_profile`

```json
{
  "project_id": "project_xxx",
  "name": "亚丝娜",
  "first_mes": "下午三点的音乐部排练室。亚丝娜抱着吉他坐在音箱上，看见你推门进来。<StatusPlaceHolderImpl/>",
  "alternate_greetings": ["...", "...", "..."],
  "include_worldbook": true,
  "worldbook_name": "亚丝娜世界"
}
```

不要手写完整 `characterCardConfig`；未传字段会自动补默认值。

### `validate_greetings`

```json
{ "project_id": "project_xxx" }
```

## 7. MVU

### `create_mvu_schema_template`

```json
{ "project_id": "project_xxx", "character_names": ["亚丝娜"] }
```

### `submit_mvu_config`

```json
{ "project_id": "project_xxx", "mvu": { "enabled": true, "style": "zod", "schema_script": "...", "initvar": "...", "update_rules": "...", ... } }
```

### `validate_mvu_config`

## 8. HTML 状态栏

### `create_html_regex_pair_template`

```json
{ "scope": "statusbar", "display_html": "<div class=\"wbm-statusbar\">...</div>" }
```

### `submit_html_beautify_config`

```json
{
  "project_id": "project_xxx",
  "html": {
    "enabled": true,
    "target": "statusbar",
    "theme": "minimal",
    "statusbar": { "enabled": true, "html": "...", "hide_regex": true },
    "global": { "enabled": false, "regex_scripts": [] }
  }
}
```

### `validate_html_beautify_config`

## 9. 最终交付审查

### `lint_project_content`
### `create_writing_optimization_report`
### `create_final_review_report`
### `create_delivery_checklist`

```json
{ "project_id": "project_xxx", "export_target": "character_card" }
```

返回中关注 `ready_to_export`。任一 blocking 都会阻止下一步。

## 10. 导出

### `generate_character_card_json`

```json
{
  "project_id": "project_xxx",
  "overwrite": false,
  "strict_review": true
}
```

`strict_review=true` 时若 checklist 未通过会拒绝导出，并返回完整 checklist 供 AI 修复后再试。

## 11. 验证导出

### `query_character_card`

```json
{ "path": "亚丝娜.json", "mode": "summary" }
```

---

## 关键点回顾

- 用户描述模糊时不要直接走默认值，先按 `task-routing.md` 判断需要询问哪些问题，再逐一走决策回路。
- 每条决策都用 `request_user_decision` + `record_user_decision`，回答会持久化。
- 启用 MVU 时开场白末尾必须含 `<StatusPlaceHolderImpl/>`。
- 单角色卡的角色拆分条目必须全部蓝灯。
- 导出前用 `create_delivery_checklist` 看是否还有 blocking；可以让 `strict_review=true` 把它当作硬闸门。
