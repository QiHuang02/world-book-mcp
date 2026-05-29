# 校验与交付

交付前建议流程：

```text
按 references 检查文本 → 必要时 write_source_file 修正
validate_project → 无 error
validate_mvu → 若启用 MVU，检查 error/warning
generate_json → 成功生成 exports
```

## validate_project 检查

- workspace.yaml 与当前 project 的 id/slug/output/source/projectPath 一致
- project/plan/draft 文件存在
- description 为空
- first_mes 存在
- source 引用不越界
- worldbook entries 合法
- plan.md entries 与 draft/worldbook 的注册状态一致
- entry abstract/status/sourceRefs 断点续写元信息
- 绿灯 keys
- 双递归
- MVU/HTML/regex/EJS 一致性
- EJS preprocess/source 引用、stage enabled、getwi await、let/const、conditionVariables
- regex replaceFile 引用、replaceFile 覆盖 replaceString warning
- HTML 状态栏 safe_macro / dynamic_js 模式安全规则

## 文本检查清单

生成前还需要按对应 reference 检查：

- 角色调色盘是否只有标签、缺少行为衍生
- 三面性是否缺五部件、语料是否混动作/心理
- 世界观是否空泛、缺少功能锚点
- first_mes 是否预设 {{user}}
- 禁词、白描、比喻、语气声线、第四面墙污染

如果发现问题，修改 source 后再运行 `validate_project`。

## generate_json 输出

```text
reports/build-report.yaml
exports/*.card.json
exports/*.worldbook.json
```
