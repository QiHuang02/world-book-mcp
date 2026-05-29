# HTML 状态栏

HTML 状态栏文件：

```text
source/html/statusbar.html
source/html/statusbar.css
```

`draft/assets.yaml`：

```yaml
html:
  statusbar:
    enabled: true
    mode: safe_macro # safe_macro | dynamic_js
    html: ../source/html/statusbar.html
    css: ../source/html/statusbar.css
```

## safe_macro 模式

默认模式，适合大多数卡：

- 禁止 `<script>`。
- 禁止外链 URL。
- 展示 MVU 变量必须使用：

```text
{{format_message_variable::stat_data.xxx}}
```

不要使用裸：

```text
{{stat_data.xxx}}
```

## dynamic_js 模式

高级模式，仅在用户明确需要交互状态栏、开场选择器或复杂 UI 时使用。

- 允许 `<script>`。
- 仍禁止外链 URL。
- 建议脚本使用 `errorCatched` 或 `try/catch`。
- 使用 MVU 数据时建议显式使用 `getAllVariables()` 或 `Mvu` API。
- 避免污染全局 DOM/CSS；`document.body`、全局 `* {}`、未 scoped 的 `.mes_text` 会触发 warning。

启用状态栏时，`first_mes` 必须包含 `<StatusPlaceHolderImpl/>`。
