# 前端美化

前端美化通过 regex 定位 AI 输出中的特定标签区域，将其替换为 HTML 界面。正文和 UI 代码都进入 `source/`，再通过 `draft/assets.yaml` 引用或通过 regex scripts 注册。

## 核心原则

- 正则只负责定位和替换，不负责承载复杂业务逻辑。
- 大段 HTML 放入 `source/html/*` 或 `source/regex/*`，regex 使用 `replaceFile`。
- 不使用 `<think>`、`<thinking>`、`<content>` 作为业务标签，避免和推理/内容边界冲突。
- 不要求模型输出真实思维链；任何“思考块”只能是卡内自定义辅助块或旧卡导入内容。
- 默认禁止外链。需要交互时按 `html-statusbar.md` 的 `dynamic_js` 规则审查。

## 模式 A：正文美化

适合：小说正文排版、信件、日记、对白气泡、公告板等。

AI 正常输出正文，只需要包裹唯一标签：

```text
<story_view>
正文内容。
角色对白。
</story_view>
```

regex：

```yaml
- name: 正文美化
  findRegex: /<story_view>[\s\S]*?<\/story_view>/g
  replaceFile: ../html/story-view.html
  markdownOnly: true
  promptOnly: false
  placement: [2]
  runOnEdit: true
```

HTML 可以自行读取当前消息文本并解析标签。若只是纯展示，也可以用 `$0` / `$1` 简单替换；复杂界面建议由 HTML 解析原文，避免正则传大段数据。

## 模式 B：结构化数据美化

适合：论坛、商店、任务面板、角色面板、地图、调查档案。

先设计结构化块：

```yaml
<forum_data>
帖子:
  - 标题: 校园夜巡公告
    作者: 学生会
    状态: 置顶
  - 标题: 旧楼异响记录
    作者: 匿名
    状态: 新帖
</forum_data>
```

再写 HTML 解析结构并渲染。

## 标签设计

- 标签名必须唯一，避免和世界书、MVU、EJS、状态栏占位符冲突。
- 推荐前缀：`story_`、`panel_`、`forum_`、`letter_`、`diary_`、`scene_`。
- 禁止业务标签：`think`、`thinking`、`content`、`UpdateVariable`、`Analysis`、`JSONPatch`。

## regex 配置模板

```yaml
- id: story-view
  name: 正文美化
  findRegex: /<story_view>[\s\S]*?<\/story_view>/g
  replaceFile: ../html/story-view.html
  markdownOnly: true
  promptOnly: false
  placement: [2]
  minDepth: null
  maxDepth: null
  runOnEdit: true
  substituteRegex: 0
  disabled: false
```

`replaceFile` 允许引用：

- `source/html/*`
- `source/regex/*`
- `source/fields/*`

## HTML 安全与兼容

- 无外链 URL。
- 复杂脚本使用 `errorCatched` 或 `try/catch`。
- CSS 作用域隔离，不写全局 `* {}`、不改 `document.body`。
- 避免 `vh`、`position: fixed`、强制撑高父容器。
- 手机端优先：宽度自适应，不产生横向滚动。
- 如果需要读取 MVU，使用 `getAllVariables()` 或 safe macro；不要混用裸 `{{stat_data.xxx}}`。

## 与状态栏的区别

- 状态栏固定使用 `<StatusPlaceHolderImpl/>`，由 builder 自动注入隐藏/替换 regex。
- 普通前端美化需要自定义标签和 regex scripts。
- MVU 变量更新美化由 builder 自动注入，不需要手写。

## 自查清单

- [ ] 标签名不与禁用标签或系统标签冲突。
- [ ] 正则定位范围不会误吞整段回复。
- [ ] 大段替换内容使用 `replaceFile`。
- [ ] HTML 无外链，脚本有错误保护。
- [ ] CSS 不污染全局。
- [ ] 若使用结构化数据，世界书条目已说明输出格式。
- [ ] 已运行 `validate_project`。
