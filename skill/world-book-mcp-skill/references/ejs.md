# EJS

EJS 用于动态加载或裁切世界书内容。可用 `create_ejs_stage_template` 生成 controller + disabled stage entries，用于分阶段人设。

EJS 文件写入：

```text
source/ejs/*.ejs
```

## 启用配置

`draft/assets.yaml` 示例：

```yaml
ejs:
  enabled: true
  preprocess:
    file: ../source/ejs/preprocess.ejs
    position: before_char
    order: 14500
    depth: 0
  entries:
    - id: controller
      file: ../source/ejs/controller.ejs
      role: controller
      enabled: true
      position: at_depth
      order: 16000
      depth: 0
      conditionVariables:
        - stat_data.世界.阶段
      complexity: dynamic_text
```

规则：EJS 依赖 MVU。未启用 MVU 时，`validate_project` 会报错。

## 复杂度分级

- 条目显隐：使用 `@@if 条件` 控制整个条目是否进入上下文。
- 段落控制：在内容文件内使用 `<%_ if (...) { _%>` / `<%_ } _%>` 裁切段落。
- 动态文本：使用 `<%- ... %>`、`getwi()`、`activewi()`、`injectPrompt()` 等高级能力。

能用简单 `@@if` 完成时，不写复杂 controller。

## 预处理

`preprocess` 会生成 `[EJS]预处理` 世界书条目，可用于 `@@generate_before`、`define()` 等变量注册逻辑。

共享条件变量集中在预处理条目中注册：

```ejs
@@generate_before
<%_
define('phase', getvar('stat_data.世界.阶段', { defaults: '序章' }));
define('affection', getvar('stat_data.角色A.好感度', { defaults: 0 }));
_%>
```

后续条目直接使用 `phase` / `affection`，不要每个条目重复读取。

## 语法规则

- `getvar()` 读取 MVU 变量时必须使用 `stat_data.` 前缀。
- `@@` 装饰器应放在文件首个非空行；`@@if` 条件必须是一行。
- `role: stage` 的阶段条目通常应禁用，由 controller 动态加载；启用时会 warning。
- EJS 标签 `<%` / `%>` 应配对；不配对会 warning。
- EJS 中使用 `getwi(` / `activewi(` 时建议分别 `await getwi(` / `await activewi(`。
- 建议使用 `var` 和 `typeof` 防重复声明；`let` / `const` 会 warning。
- 使用 `stat_data.xxx` 时应在 `conditionVariables` 中登记，便于校验变量依赖。

## controller 模板

```ejs
@@generate_before
<%_
if (typeof phase === 'undefined') {
  var phase = getvar('stat_data.世界.阶段', { defaults: '' });
}
_%>
<%_
if (typeof stageEntry === 'undefined') { var stageEntry = ''; }
if (phase === '序章') { stageEntry = 'stage-intro'; }
if (phase === '信任') { stageEntry = 'stage-trust'; }
if (stageEntry) {
  await getwi(stageEntry);
}
_%>
```

## 多阶段调色盘原则

- `base_profile` / 底色不随阶段变化。
- `common_derivations` 跨阶段始终存在。
- `exclusive_derivations` 是该阶段新出现的行为，不是上一阶段的升级版。
- `rephrase_notes` 用于阶段专属二次解释。
- 阶段条件边界不重叠、不遗漏。
- 不改写用户手写的衍生，只做结构整合。

结构顺序：

```text
1. 变量读取或预处理短变量
2. 通用底色/基础人设
3. 阶段调色盘头部
4. 阶段专属衍生
5. 跨阶段通用衍生
6. 阶段专属二次解释
7. 跨阶段通用二次解释
8. 总结
```

段落裁切示例：

```ejs
<character_stage>
底色: 好奇
通用衍生:
  - 看到陌生机关时会先绕一圈观察
<%_ if (phase === '初识') { _%>
阶段: 初识
主色调:
  - 警惕
阶段专属衍生:
  - 不接受来历不明的礼物
<%_ } _%>
<%_ if (phase === '信任') { _%>
阶段: 信任
主色调:
  - 主动靠近
阶段专属衍生:
  - 会把备用钥匙放在{{user}}能拿到的位置
<%_ } _%>
</character_stage>
```

## 做不到时的边界

EJS 不适合：

- 网络请求。
- 文件系统操作。
- 定时任务。
- 复杂 JSON 解析和大规模数据处理。
- 未在知识库模板覆盖的高级前端功能。

这类需求改用 Tavern Helper 脚本或前端 `dynamic_js`，并记录风险。

## 自查清单

- [ ] EJS 启用时 MVU 已启用。
- [ ] 所有 MVU 路径使用 `stat_data.`。
- [ ] `conditionVariables` 登记了使用到的 `stat_data.xxx`。
- [ ] 共享变量放在 preprocess 中。
- [ ] `getwi` / `activewi` 使用 `await`。
- [ ] 使用 `var` + `typeof` 防重复声明。
- [ ] 阶段条目禁用，由 controller 加载。
- [ ] 阶段条件不重叠、不遗漏。
- [ ] 已运行 `validate_project`。
