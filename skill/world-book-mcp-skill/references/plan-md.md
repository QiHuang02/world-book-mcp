# plan.md

默认 13 个 section，并在世界观/角色规划中提供结构化 YAML block。plan.md 必须在 grill-me 拷打前创建，因为每轮拷打都要即时写入：

1. 用户原始需求
2. 项目属性
3. 用户决策记录
4. 世界观规划
5. 角色规划
6. 开场白规划
7. 世界书条目规划
8. MVU / HTML / regex / EJS 规划
9. 待办清单
10. 验收标准
11. 验证记录
12. 风险与未决问题
13. 二创提取索引

世界书条目规划建议保留结构化 fenced YAML：

```yaml
entries:
  - id: character-basic-heroine
    type: character_basic
    part: basic
    scope: catalog
    source: source/entries/010-character-basic-heroine.xyaml
    dependsOn:
      - source/references/chapter-01.md
    status: planned
```

资产规划建议保留：

```yaml
mvu:
  variables: []
ejs:
  generate_before: []
  entries: []
html:
  statusbar: disabled
regex:
  scripts: []
```

## grill-me 记录

每轮需求拷打后立即写入 plan，建议格式：

```text
[grill-me] 问题：……
推荐答案：……
用户决定：……
影响范围：……
状态：已确认 / 待确认 / 记录为风险
```

写入位置：

- 用户确认的选择：`用户决策记录`，并同步更新对应规划 section。
- 仍未确定但不阻塞的事项：`风险与未决问题`。
- 会影响最终交付判断的要求：`验收标准`。
- 后续需要执行的动作：`待办清单`。

不得等全部 grill-me 问题完成后再批量补写；上一轮未记录时，不继续下一轮关键问题。

`update_plan` 模式：`replace_section`、`append_section`、`append_decision`、`append_todo`、`update_todo`、`append_acceptance`、`append_verification`、`append_risk`。
