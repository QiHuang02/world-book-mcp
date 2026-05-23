# 用户决策回路

> 何时阅读：用户需求存在多个合理方向时使用，例如卡型、世界观类型、是否启用 MVU/HTML/EJS、二创提取范围、修改已有 JSON 的目标等。

决策回路用于把“需要用户确认的问题”记录到项目里。这样后续校验、交付检查和继续对话时，都能知道哪些问题已经确认、哪些还没确认。

## 使用顺序

1. 按 [`task-routing.md`](task-routing.md) 判断哪些信息还不明确。
2. 用 `request_user_decision` 登记问题和选项。
3. 将返回的问题文本展示给用户。
4. 用户回答后，用 `record_user_decision` 保存选择。
5. 继续正常工作流。

## 工具一览

| 工具 | 作用 |
|---|---|
| `request_user_decision` | 登记待确认问题；生成可展示给用户的选项文本 |
| `record_user_decision` | 保存用户选择；从 pending 移到 recorded |
| `list_user_decisions` | 查看待确认和已确认的问题 |
| `clear_user_decision` | 清除指定问题，便于重新询问 |

## 常见决策模板

### 原创 / 二创

```json
{
  "id": "origin_type",
  "question": "请确认这次任务是原创、二创还是混合？",
  "options": [
    { "value": "original", "label": "原创", "description": "无原作素材，由用户提供创意" },
    { "value": "derivative", "label": "二创", "description": "基于已有小说/游戏/网页等素材" },
    { "value": "mixed", "label": "混合", "description": "原创为主，借鉴部分已有素材" }
  ],
  "allow_custom": false,
  "multiple": false,
  "source_tool": "skill.task-routing"
}
```

### 卡型

```json
{
  "id": "card_type",
  "question": "请确认卡型（决定蓝绿灯策略）",
  "options": [
    { "value": "single_character_card", "label": "单角色卡", "description": "1 个核心角色，所有拆分条目蓝灯", "is_recommended": true },
    { "value": "multi_character_card", "label": "多角色卡", "description": "2+ 核心角色，速览蓝灯/详情绿灯" },
    { "value": "worldbook_only", "label": "纯世界书", "description": "无角色卡承载，由系统/EJS 驱动" }
  ],
  "allow_custom": false,
  "multiple": false,
  "source_tool": "skill.task-routing"
}
```

### 世界观类型

```json
{
  "id": "worldbuilding_type",
  "question": "请确认世界观类型 A/B/C",
  "options": [
    { "value": "A_realistic_background", "label": "A 真实背景", "description": "现代/历史现实舞台，只补必要细节" },
    { "value": "B_small_world", "label": "B 小世界", "description": "学校、宅邸、小镇等封闭舞台" },
    { "value": "C_large_world", "label": "C 大世界", "description": "架空大陆、奇幻/科幻文明" }
  ],
  "allow_custom": false,
  "multiple": false,
  "source_tool": "skill.task-routing"
}
```

### 二创提取维度

```json
{
  "id": "extraction_focus",
  "question": "请确认要提取哪些维度",
  "options": [
    { "value": "characters", "label": "角色", "is_recommended": true },
    { "value": "world", "label": "世界观" },
    { "value": "items", "label": "物品/能力" },
    { "value": "events", "label": "事件" },
    { "value": "style", "label": "文风" },
    { "value": "chapters", "label": "章节" }
  ],
  "allow_custom": false,
  "multiple": true,
  "source_tool": "skill.task-routing"
}
```

### 是否启用扩展能力

```json
{
  "id": "wants_mvu",
  "question": "是否启用 MVU/ZOD 变量系统？",
  "options": [
    { "value": "yes", "label": "是" },
    { "value": "no", "label": "否" }
  ],
  "allow_custom": false,
  "multiple": false,
  "source_tool": "skill.task-routing"
}
```

同类问题可使用稳定 id：

- `wants_html`：是否启用 HTML 状态栏 / 前端美化。
- `wants_ejs`：是否启用 EJS 动态内容。
- `source_kind`：二创素材类型。
- `modification_kind`：修改已有 JSON 的操作类型。

## 完整生命周期示例

```text
1. 判断需要确认：卡型、世界观类型、是否启用 MVU/HTML
2. request_user_decision (id: card_type)
3. 将问题文本展示给用户
4. 用户回答：单角色卡
5. record_user_decision (id: card_type, selected_values: ["single_character_card"])
6. 继续询问 worldbuilding_type / wants_mvu / wants_html
7. 所有关键问题确认后进入正常工作流
8. 导出前运行 create_delivery_checklist
9. generate_character_card_json strict_review=true
```

## 使用注意

- 同一 id 的新问题会覆盖当前 pending；如果用户改主意，先 `clear_user_decision` 再重新询问。
- 已确认的答案与当前上下文冲突时，先 clear 再重新记录。
- 使用稳定 id，例如 `card_type`、`worldbuilding_type`、`wants_mvu`，不要使用随机字符串。
- `record_user_decision` 会校验选项；不允许自由输入的问题只能记录列出的 `value`。
- pending decisions 会影响 `create_delivery_checklist`；交付前应全部解决。
