# v5 总流程

```text
用户需求
→ 初筛最小建项信息
→ init_project 创建 plan.md
→ grill-me 式主题询问 / 设计拷打
→ 每拷打一次立即 update_plan 写 plan.md
→ write_source_file 写 source
→ write_draft / configure_draft 维护 draft YAML
→ 按 references 检查并修订文本
→ validate_project
→ repair_project / validate_mvu
→ update_entry_status / query_entries 跟踪条目进度
→ check_delivery
→ generate_json
→ 返回 exports 路径
```

原则：先创建可记录决策的 plan.md，再完成需求澄清与计划记录，然后维护 draft/source，最后校验、修复并生成 JSON。

## grill-me 前置

在正式填充/定稿 plan，并继续写 source 与 draft YAML 之前，必须先按 grill-me 方式压测需求与设计分支：

- 每次只问一个问题，沿输出目标、来源、世界观、角色、`{{user}}` 边界、开场白、资产和验收标准逐个解决依赖分支。
- 每个问题都必须提供推荐答案，方便用户直接确认或修正。
- 如果问题能通过已有 plan、draft、source、导入 JSON 或代码库探索回答，先自行探索，不向用户重复提问。
- 用户每回答一次，必须立刻调用 `update_plan` 记录该轮问题、推荐答案、用户决定、影响范围和状态。
- 未记录上一轮拷打结果前，不进入下一轮关键问题；未完成关键分支确认前，不开始正式写 source / draft。
