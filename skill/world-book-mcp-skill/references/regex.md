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

scripts 支持 `replaceFile`，用于把大段替换内容放到 source 文件中：

```yaml
- name: 状态栏替换
  findRegex: <StatusPlaceHolderImpl/>
  replaceFile: ../html/statusbar.html
  markdownOnly: true
  promptOnly: false
```

生成 JSON 时 `replaceFile` 会被读取并写入最终 Tavern regex 的 `replaceString`。如果同时写了 `replaceString`，`replaceFile` 优先，`validate_project` 会给 warning。

导入旧卡时，普通 regex scripts 会迁移到此文件；状态栏 regex 会被拆分到 `source/html/statusbar.html/css`。
