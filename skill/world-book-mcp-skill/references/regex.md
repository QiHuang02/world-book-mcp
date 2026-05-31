# regex

regex scripts 写入：

```text
source/regex/scripts.yaml
```

并由 `draft/assets.yaml` 引用：

```yaml
regex:
  scripts: ../source/regex/scripts.yaml
```

## scripts 基本格式

```yaml
- id: custom-regex
  name: 自定义正则
  findRegex: /pattern/g
  replaceString: 替换内容
  markdownOnly: true
  promptOnly: false
  placement: [2]
  minDepth: null
  maxDepth: null
  runOnEdit: false
  substituteRegex: 0
  disabled: false
```

`scripts` 支持 `replaceFile`，用于把大段替换内容放到 source 文件中：

```yaml
- id: statusbar-view
  name: 状态栏替换
  findRegex: <StatusPlaceHolderImpl/>
  replaceFile: ../html/statusbar.html
  markdownOnly: true
  promptOnly: false
```

生成 JSON 时 `replaceFile` 会被读取并写入最终 Tavern regex 的 `replaceString`。如果同时写了 `replaceString`，`replaceFile` 优先，`validate_project` 会给 warning。

## MVU/状态栏内置 regex

启用 MVU / HTML 状态栏后，builder 会自动注入：

- `[不发送]去除变量更新`：prompt 阶段隐藏 `<UpdateVariable>`、`<Analysis>`、`<JSONPatch>`、`<update>`、`<updatevariable>` 等机器块。
- `[界面]变量更新中美化`：渲染未闭合的变量更新块，显示“正在更新”。
- `[界面]变量更新美化`：渲染完整变量更新块为可折叠 HTML。
- `[不发送]界面占位符`：prompt 阶段隐藏 `<StatusPlaceHolderImpl/>`。
- `[界面]状态栏`：渲染阶段用 HTML/CSS 替换占位符。

`apply_mvu_preset({ preset: "tavern_cards" })` 会额外生成 `source/html/变量更新中美化.html` 与 `source/html/变量更新美化.html`，作为内置 MVU 美化 regex 的可替换模板参考。默认生成 JSON 时仍由 builder 自动注入内置 regex，不要求用户手写 scripts。

## 可选：辅助块/杂标签清理

只用于旧卡迁移或用户明确设计了自定义辅助块的情况。不要要求模型输出真实思维链；不要把 `<think>` / `<thinking>` / `<content>` 作为业务标签。

### 隐藏自定义思考块

```yaml
- id: hide-custom-thought
  name: 去除自定义辅助块
  findRegex: /\[(?:metacognition|love_qkll)\]\s*((?:(?!\n(?:<\/thinking>|<content>)).)+)\s*\n(?:<\/thinking>|(?=<content>))/si
  replaceString: ""
  markdownOnly: false
  promptOnly: true
  placement: [2]
  runOnEdit: false
  substituteRegex: 0
  disabled: false
```

### 美化未闭合辅助块

```yaml
- id: custom-thought-loading
  name: 辅助块生成中美化
  findRegex: /\[(?:metacognition|love_qkll)\](?!.*(?:\n(?:<\/thinking>|<content>)))\s*(.+)\s*$/si
  replaceFile: ../regex/custom-thought-loading.html
  markdownOnly: true
  promptOnly: false
  placement: [2]
  runOnEdit: false
  substituteRegex: 0
  disabled: false
```

### 美化完整辅助块

```yaml
- id: custom-thought-done
  name: 辅助块完整美化
  findRegex: /\[(?:metacognition|love_qkll)\]\s*((?:(?!\n(?:<\/thinking>|<content>)).)+)\s*\n(?:<\/thinking>|(?=<content>))/si
  replaceFile: ../regex/custom-thought-done.html
  markdownOnly: true
  promptOnly: false
  placement: [2]
  runOnEdit: false
  substituteRegex: 0
  disabled: false
```

### 清理杂标签

```yaml
- id: remove-noise-tags
  name: 去杂标签
  findRegex: /<(recap|safe)>(?:(?!.*<\/\1>)(?:(?!<\1>).)*$|(?:(?!<\1>).)*<\/\1?>)/gsi
  replaceString: ""
  markdownOnly: true
  promptOnly: true
  placement: [2]
  runOnEdit: false
  substituteRegex: 0
  disabled: false
```

## replaceFile 推荐目录

`replaceFile` 必须指向以下目录之一：

- `source/html/*`
- `source/regex/*`
- `source/fields/*`

## 导入规则

导入旧卡时：

- 普通 regex scripts 会迁移到 `source/regex/scripts.yaml`。
- 状态栏 regex 会被拆分到 `source/html/statusbar.html/css`。
- 含大段 HTML 的替换内容建议手动改成 `replaceFile`，减少 YAML 体积。

## 自查清单

- [ ] `findRegex` 不会误吞多条消息或整段聊天。
- [ ] 大段 HTML 使用 `replaceFile`。
- [ ] promptOnly 只用于不发送给模型的隐藏/清理脚本。
- [ ] markdownOnly 只用于显示层替换。
- [ ] 没有用 regex 诱导模型输出真实思维链。
- [ ] 已运行 `validate_project`。
