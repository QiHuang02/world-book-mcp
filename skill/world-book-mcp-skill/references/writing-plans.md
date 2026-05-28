# 可执行计划写作规范

本规范吸收 superpowers `writing-plans` 的方法：先明确目标、范围、任务拆分、验收和验证，再进入具体写作或资产编辑。world-book-mcp 中的计划不是普通备忘录，而是交付前可校验的事实源。

## 什么时候必须写结构化计划

以下任务必须先用 `update_plan` 写入结构化 plan item：

- 新建完整世界书或角色卡。
- 修改已有 Tavern JSON。
- 涉及 MVU / HTML / regex / EJS 任一资产。
- 会影响 build、delivery 或最终导出的改动。
- 用户需求包含多阶段目标、多个角色、多来源素材或待决问题。

轻量文本修正可以只 `append_note`，但交付前仍应补齐 acceptance 与 verification。

## 计划必须包含

- Goal：本轮最终要交付什么。
- Scope：会改哪些 project metadata、slices、资产、导出目标。
- Non-goals：明确不做什么，避免范围蔓延。
- Assumptions：无法从用户或来源中确认但暂时采用的假设。
- Slice / Asset map：entry、mvu、html、regex、ejs 的目标切片和工具。
- Implementation tasks：可执行任务，每项有稳定 id。
- Acceptance criteria：用户可验收的完成条件。
- Verification steps：MCP 校验、build、delivery、内容自查命令或步骤。
- Risks / blockers：未决问题、来源不足、兼容风险。

## 推荐工具流

```text
update_plan(mode="upsert_plan_item", plan_item={...})
→ update_plan(mode="append_acceptance", acceptance_criterion="...")
→ update_plan(mode="append_verification", verification_step="...")
→ 若有风险：update_plan(mode="append_risk", risk_note="...")
→ 执行对应语义化编辑工具
→ update_plan(mode="update_plan_item_status", plan_item_status={id, status="done"})
→ validate_project(scope="plan")
```

## Plan item 编写规则

- `id` 稳定、短、可引用，例如 `entry-world-summary`、`mvu-variables`、`html-statusbar`。
- `category` 必须贴近实际目标：`worldbook`、`character_card`、`mvu`、`html`、`regex`、`ejs`、`build`、`delivery`。
- `target` 指向对应 `draftType/sliceId/tool`。
- 每个 item 至少有一个 acceptance 或全局 acceptance 覆盖。
- 有依赖时写 `dependsOn`，不要靠自然语言暗示。
- blocked item 不得在 delivery 前遗留；若用户决定跳过，标记 `skipped` 并说明原因。

## 验收与验证

验收标准写用户可判断的结果，例如：

- 世界书包含 4 个 active entry，keys 覆盖主要触发词。
- 角色卡 first_mes 包含 `<StatusPlaceHolderImpl/>`。
- MVU 变量包含 `角色A.好感度` 且 updateRules 有更新条件。

验证步骤写实际检查方式，例如：

- `validate_project(scope="all")` 无 blocking。
- `build_assets(target="all")` 成功生成 manifest。
- `validate_project(scope="delivery", build_id=...)` 通过。
- `generate_json(build_id=...)` 输出目标文件。

## 禁止事项

- 不把计划写成只有“我会做 X”的泛泛说明。
- 不在 pending decision 未解决时把猜测写进成品 slice。
- 不让 plan item 长期停留 `in_progress` 后直接导出。
- 不把内容审美作为 MCP blocking；主观质量自查写在 skill 层。
