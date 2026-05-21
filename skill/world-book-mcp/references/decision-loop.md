# 用户决策回路

> 何时阅读：当 AI 检测到用户需求模糊（卡型 / 世界观类型 / 是否启用 MVU/HTML/EJS / 提取焦点等），或 `get_worldbook_capability_matrix` 中某条任务标了 `decision_hint=prefer_clarification` 时，先读这份再调用 `request_user_decision`。

---

MCP 工具的调用是请求—响应模型，工具内部不能"暂停 + 唤起用户"。控制权始终在 AI 手里。`world-book-mcp` 用一组配套的工具实现等价的"AI 编排式询问—回答"机制，让 AI 在不确定时正式向用户发问，用户回答持久化保存，并在导出前作为闸门。

---

## 设计原则

1. AI 主动判断歧义，主动调用 `request_user_decision`。MCP 不替 AI 做决定。
2. 问题与回答都保存在 `project.pendingDecisions / recordedDecisions`，跨工具调用、跨对话可见。
3. 工具不会"自动暂停" AI，仅返回"请向用户复述"的格式化文本。
4. 导出层有两道闸门：`create_delivery_checklist` 把 pending 计入 blocking；`generate_*_json strict_review=true` 强制要求 checklist 通过。

---

## 工具一览

| 工具 | 作用 |
|---|---|
| `request_user_decision` | 写入 pending；返回 prompt_text 供 AI 复述 |
| `record_user_decision` | 写入 recorded；从 pending 移除；返回 recommended_next_tool |
| `list_user_decisions` | 列出 pending / recorded |
| `clear_user_decision` | 清掉指定 id 的 pending 与 recorded |

---

## 与 clarification 的关系

`classify_worldbook_task` / `propose_clarification_questions` 会输出 `suggested_decisions`（一组 SuggestedDecision），AI 拿到后可以几乎直接 spread 给 `request_user_decision`：

```json
{
  "project_id": "project_xxx",
  "id": "card_type",
  "question": "请确认卡型",
  "options": [...],
  "allow_custom": false,
  "multiple": false,
  "source_tool": "classify_worldbook_card_type"
}
```

`request_user_decision` 返回的 `prompt_text` 已经包含问题、选项编号、推荐项、是否允许自由输入等，AI 只需把它复述给用户即可。

---

## prefer_user_decision

部分判定型工具支持 `prefer_user_decision: true`，强制走决策回路而不返回默认推断结果：

- `classify_worldbook_task`
- `classify_worldbook_card_type`
- `classify_worldbuilding_type`

返回中包含：

```json
{
  "needs_user_decision": true,
  "recommended_next_tool": "request_user_decision",
  "suggested_decisions": [...]
}
```

AI 可以在不确定时显式启用此开关，把决定权交给用户。

---

## 决策状态如何被使用

### `create_final_review_report`

新增 `pending_decisions` section：当 `pendingDecisions.length > 0` 时为 warning，并加入推荐 `record_user_decision` 的提示。final review 本身不阻断导出，仅做汇总。

### `create_delivery_checklist`

把 pending decisions 升级为 **blocking**：未解决就 `ready_to_export = false`。

### `get_worldbook_capability_matrix`

每条任务标注 `decision_hint`：

- `auto`：默认走自动判定（如 `query_existing`、`modify_existing`、`content_lint`）
- `prefer_clarification`：建议先走决策（其他大多数任务）

AI 可以以此选择是否启用 `prefer_user_decision`。

### `generate_worldbook_json` / `generate_character_card_json`

新增 `strict_review: boolean`。`true` 时若 delivery checklist 未通过（包括 pending decisions），直接返回 ok=false 并附完整 checklist。

---

## 完整生命周期示例

```
1. classify_worldbook_task                  # 给出 suggested_decisions
2. request_user_decision (id: card_type)    # 写入 pending
   → AI 复述 prompt_text 给用户
   ← 用户回答
3. record_user_decision (id: card_type)     # 移到 recorded
4. request_user_decision (id: worldbuilding_type)
   ...
5. record_user_decision (id: worldbuilding_type)
6. classify_worldbook_card_type             # 现在带上用户决定
7. ... 进入正常工作流
8. create_delivery_checklist                # 检查导出条件
9. generate_character_card_json strict_review=true
```

---

## 何时使用 clear_user_decision

- 用户改变主意：调用 `clear_user_decision` 然后 `request_user_decision` 重新发起。
- AI 判定先前 recorded 的答案与当前上下文冲突：先 clear 再询问。
- pending 已经过期且不再适用：直接 clear。

---

## 边界与限制

- MCP 不做真正的 elicitation。控制权回到 AI 后，AI 必须在对话中主动复述 prompt_text 给用户。
- 同一 id 的 `request` 会覆盖 pending；如已存在 recorded，AI 可选择 clear 后重发。
- `record_user_decision` 在选项不允许自由输入时会拒绝非法 selected_values。
- pending 与 recorded 仅按 id 关联；AI 应使用稳定的 id（如 `card_type`、`worldbuilding_type`），避免随机字符串。
