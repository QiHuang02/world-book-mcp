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
    variablePaths:
      - stat_data.角色A.好感度
```

启用状态栏时，`first_mes` 必须包含 `<StatusPlaceHolderImpl/>`。

## 占位符双通道

状态栏使用 `<StatusPlaceHolderImpl/>` 作为占位符：

- prompt 阶段用 regex 隐藏占位符，避免发给 AI。
- 渲染阶段用 regex 替换成 `source/html/statusbar.html` 与可选 CSS。

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

示例：

```html
<div class="status-card">
  <div class="status-row">
    <span>好感度</span>
    <strong>{{format_message_variable::stat_data.角色A.好感度}}</strong>
  </div>
  <div class="status-row">
    <span>地点</span>
    <strong>{{format_message_variable::stat_data.世界.地点}}</strong>
  </div>
</div>
```

```css
.status-card {
  width: 92%;
  margin: 12px auto;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 14px;
  background: rgba(15, 23, 42, .72);
  color: #e2e8f0;
}
.status-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}
```

## dynamic_js 模式

高级模式，仅在用户明确需要交互状态栏、开场选择器或复杂 UI 时使用。

- 允许 `<script>`。
- 仍禁止外链 URL。
- 必须使用 `errorCatched` 或 `try/catch`。
- 使用 MVU 数据时建议显式使用 `getAllVariables()` 或 Mvu 事件。
- 避免污染全局 DOM/CSS；`document.body`、全局 `* {}`、未 scoped 的 `.mes_text` 会触发 warning。
- 不使用 `vh` 等依赖宿主高度的单位；优先用 `width`、`aspect-ratio`、普通文档流。
- 页面整体适配容器宽度，不产生横向滚动条。
- 只用 `/* 注释 */`，避免在内嵌脚本中使用容易被宿主处理破坏的注释格式。

参考骨架：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <style>
  .wf-status-root {
    width: 92%;
    margin: 12px auto;
    border-radius: 14px;
    color: #e2e8f0;
  }
  </style>
  <script type="module">
    async function initStatusBar() {
      await waitGlobalInitialized('Mvu');
      function render() {
        const allVariables = getAllVariables();
        const statData = _.get(allVariables, 'stat_data', {});
        $('#wf-location').text(_.get(statData, '世界.地点', '未知'));
      }
      render();
      if (typeof Mvu !== 'undefined' && Mvu.events) {
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, render);
      }
    }
    $(errorCatched(initStatusBar));
  </script>
</head>
<body>
  <div class="wf-status-root">
    <span>地点：</span><strong id="wf-location">读取中</strong>
  </div>
</body>
</html>
```

## 变量选择流程

生成状态栏前先确认：

1. 变量结构：读取 `source/mvu/schema.js` 或 `list_mvu_variables`。
2. 展示范围：核心状态、世界状态、角色状态、物品/任务等。
3. UI 风格：简约、古风、科幻、游戏 UI、卡片式等。
4. 模式：默认 `safe_macro`；只有确需交互时才用 `dynamic_js`。

读取 MVU 变量路径前，可用 `convert_mvu_path` 将 YAML 点路径转换为状态栏/EJS 所需的 `stat_data.xxx` 形式，避免和 AI JSON Patch 的 `/xxx` 路径混用。

## 自查清单

- [ ] `first_mes` 包含 `<StatusPlaceHolderImpl/>`。
- [ ] `safe_macro` 模式没有 `<script>` 和外链。
- [ ] 展示变量使用 `{{format_message_variable::stat_data.xxx}}`。
- [ ] `dynamic_js` 模式没有外链，并有错误保护。
- [ ] CSS 作用域隔离，不污染全局。
- [ ] 状态栏变量与 `initvar.yaml`、开场白初始状态一致。
- [ ] 已运行 `validate_project`。
