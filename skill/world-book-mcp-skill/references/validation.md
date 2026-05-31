# 校验与交付

交付前建议流程：

```text
按 references 检查文本 → 必要时 write_source_file 修正
validate_project → 无 error
validate_mvu → 若启用 MVU，检查 error/warning
generate_json → 成功生成 exports
check_delivery → 完整交付门禁通过
```

## validate_project 检查

- workspace.yaml 与当前 project 的 id/slug/output/source/projectPath 一致。
- project/plan/draft 文件存在。
- description 为空。
- first_mes 存在。
- source 引用不越界。
- worldbook entries 合法。
- plan.md entries 与 draft/worldbook 的注册状态一致。
- entry abstract/status/sourceRefs 断点续写元信息。
- 绿灯 keys。
- 双递归。
- MVU/HTML/regex/EJS/Tavern Helper 一致性。
- EJS preprocess/source 引用、stage enabled、getwi await、let/const、conditionVariables。
- regex replaceFile 引用、replaceFile 覆盖 replaceString warning。
- HTML 状态栏 safe_macro / dynamic_js 模式安全规则。
- Tavern Helper 本地脚本引用、外链授权和脚本来源风险。

## validate_mvu 检查

- schema 是否可解析和运行。
- initvar 是否符合 schema。
- schema parse 是否幂等。
- update-rules 是否误包含 `_` / `$` 变量。
- variable-list / output-format 是否覆盖变量或使用标准整体变量块。
- `initvar.yaml` 是否多包 `stat_data:`。

## Skill 人工/创作审查清单

以下检查偏语义判断，不交给 MCP 自动报错；由 skill 在生成前阅读 source 与 plan 后人工审查：

- 世界观是否完成 A/B/C 判定。
- 世界观是否空泛、缺少功能锚点。
- 世界观是否复述真实世界常识或类型套路。
- 角色基础是否只有万能美人描写。
- 角色调色盘是否只有标签、缺少行为衍生。
- 三面性是否缺五部件、语料是否混动作/心理。
- 二次解释是否说明“不要误读成什么 / 应理解为什么”。
- 衣柜是否规定固定穿搭，而不是列拥有物。
- NPC 是否过度设计，写了不需要的完整人设。
- first_mes 是否预设 `{{user}}` 的性别、外貌、身份、行为、心理或固定关系。
- 禁词、白描、比喻、语气声线、第四面墙污染。
- 启用 MVU 时，`initvar.yaml` 的初始地点、阶段、关系/好感度是否与 `first_mes` 明示内容冲突。
- 状态栏展示的变量是否能在开场初始状态中自洽；例如状态栏显示“门口”，开场却明确写成“庭院”。
- `z.enum()` 的阶段值、地点值、关系值是否有世界书条目、变量列表或更新规则解释。
- EJS 阶段条件是否不重叠、不遗漏。
- regex 是否误吞正文，是否诱导真实思维链输出。
- Tavern Helper 是否包含未授权外链、破限提示、强制思维链或非脚本内容。

如果发现问题，修改 source 或 MVU 五件套后再运行 `validate_project` / `validate_mvu`。

## generate_json 输出

```text
reports/build-report.yaml
exports/*.card.json
exports/*.worldbook.json
```

## 最终回复

最终交付回复应包含：

- exports 路径。
- validation summary。
- build report 路径。
- 剩余 warning 或人工风险。
- 如启用外链 Tavern Helper，明确提示用户已记录风险。
