# 用户决策回路

当任务存在多个合理方向时，使用 MCP 决策工具记录，不靠对话记忆。

## 顺序

```text
request_user_decision
→ 向用户展示问题
→ record_user_decision
→ update_plan(mode="append_decision")
→ 继续 draft
```

## 稳定 id

- `origin_type`：原创 / 二创 / 混合 / 修改已有。
- `output_target`：worldbook / character_card / both。
- `card_type`：单角色卡 / 多角色卡 / 纯世界书。
- `worldbuilding_type`：现实背景 / 小世界 / 大世界。
- `mvu_enabled`、`html_enabled`、`ejs_enabled`。
- `extraction_focus`：characters/world/items/events/style/chapters。
- `export_filename`。

## 交付影响

pending decisions 会进入 `validate_draft(scope="plan")`、`review_project` 和 `check_delivery`。导出前应全部解决；不要用猜测替代用户决策。

## 注意

- 同一 id 需要重问时，先 `clear_user_decision`。
- 已记录决策和当前需求冲突时，先清除再记录新答案。
- 决策答案必须写入 plan，便于断点续作和 review。
