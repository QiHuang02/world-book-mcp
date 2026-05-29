# plan.md

默认 13 个 section，并在世界观/角色规划中提供结构化 YAML block：

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

`update_plan` 模式：`replace_section`、`append_section`、`append_decision`、`append_todo`、`update_todo`、`append_acceptance`、`append_verification`、`append_risk`。
