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

## MVU/状态栏内置 regex

启用 MVU / HTML 状态栏后，builder 会自动注入：

- `[不发送]去除变量更新`：prompt 阶段隐藏 `<UpdateVariable>`、`<Analysis>`、`<JSONPatch>`、`<update>`、`<updatevariable>` 等机器块。
- `[界面]变量更新中美化`：渲染未闭合的变量更新块，显示“正在更新”。
- `[界面]变量更新美化`：渲染完整变量更新块为可折叠 HTML。
- `[不发送]界面占位符`：prompt 阶段隐藏 `<StatusPlaceHolderImpl/>`。
- `[界面]状态栏`：渲染阶段用 HTML/CSS 替换占位符。

`apply_mvu_preset({ preset: "tavern_cards" })` 会额外生成 `source/html/变量更新中美化.html` 与 `source/html/变量更新美化.html`，作为内置 MVU 美化 regex 的可替换模板参考。默认生成 JSON 时仍由 builder 自动注入内置 regex，不要求用户手写 scripts。

导入旧卡时，普通 regex scripts 会迁移到此文件；状态栏 regex 会被拆分到 `source/html/statusbar.html/css`。
