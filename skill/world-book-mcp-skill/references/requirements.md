# 需求对齐

## 粗略规划

用户只给一句需求时，先 `init_project`，再确认最低限度信息：输出目标、单卡/多卡、题材边界、是否启用 MVU/HTML/EJS、禁忌内容、导出文件名。

## 完整规划

完整项目应记录：

- 任务类型：original / derivative / mixed / modify_existing。
- 输出目标：worldbook / character_card / both。
- 卡型：单角色卡 / 多角色卡 / 群像世界书。
- 角色列表、称呼、关系、冲突。
- 世界观边界、地点、组织、规则。
- 资产需求：MVU、HTML 状态栏、EJS 动态条目。
- 文风与禁词。
- planned entries：条目名、类型、蓝/绿灯、keys、order、position。

## 用户决策

使用稳定 id：`card_type`、`output_target`、`mvu_enabled`、`html_enabled`、`ejs_enabled`、`tone_style`、`export_filename`。

流程：

```text
request_user_decision
→ record_user_decision
→ update_plan(mode="append_decision")
```

不确定时写 pending decision，不把猜测写进成品 draft。
