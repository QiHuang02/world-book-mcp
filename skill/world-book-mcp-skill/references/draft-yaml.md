# draft YAML

Draft 是生成 JSON 的直接配置源。不要手写最终 `.card.json` / `.worldbook.json`。

## card.yaml

- `description` 必须是 `""`。
- `first_mes` 必须引用 `source/fields/first_mes.md`。
- `alternate_greetings` 必须引用 `source/fields/*`。
- `personality/scenario/creator_notes` 等人设内容应进入世界书条目，而不是 card 字段。

示例：

```yaml
name: 示例卡
description: ""
personality: ""
scenario: ""
first_mes: ../source/fields/first_mes.md
alternate_greetings:
  - ../source/fields/greeting-01.md
mes_example: ""
creator_notes: ""
system_prompt: ""
post_history_instructions: ""
creator: ""
character_version: "1.0"
talkativeness: "0.5"
fav: false
worldbook:
  include: true
  name: 示例卡
```

注意：字段名必须使用 schema 规定的英文名，不能为了中文 YAML 风格改成中文。

## worldbook.yaml

- entry 必须有稳定 `id`。
- `content` 必须引用 `source/entries/*`。
- `position/order/depth/scanDepth` 决定插入位置。
- `preventRecursion` 与 `excludeRecursion` 必须为 true。
- `constant: false` 时必须有 keys。

推荐 entry type：

```yaml
world_summary: 世界观总纲
background: 背景、社会结构、基础规则
character_overview: 角色速览
character_basic: 角色基础信息
character_personality: 角色性格总项
character_palette: 性格调色盘
character_facets: 三面性/多面性
character_relationships: 关系画面
character_rephrase: 二次解释
character_wardrobe: 衣柜
character_stage: 多阶段人设
player: {{user}} 边界
npc: NPC
item: 物品
ability: 能力/规则体系
scene: 场景
event: 事件
faction: 势力
style: 文风/输出规则
dialogue: 对话语料
other: 其他
```

示例：

```yaml
name: 示例卡
entries:
  - id: heroine-basic
    comment: 女主基础信息
    type: character_basic
    content: ../source/entries/010-heroine-basic.xyaml
    enabled: true
    constant: true
    keys: []
    secondary_keys: []
    position: after_char
    order: 100
    depth: 4
    scanDepth: null
    preventRecursion: true
    excludeRecursion: true
    part: heroine.basic
    scope: catalog
    status: drafted
    abstract: 女主身份、外貌识别点、关键背景
```

## assets.yaml

- MVU 文件放 `source/mvu/*`。
- HTML 状态栏放 `source/html/*`。
- regex scripts 放 `source/regex/scripts.yaml`。
- EJS 文件放 `source/ejs/*`，且 EJS 依赖 MVU。
- Tavern Helper 脚本放 `source/tavern-helper/*`，默认禁止外链，必须显式声明。

示例：

```yaml
mvu:
  enabled: true
  schema: ../source/mvu/schema.js
  initvar: ../source/mvu/initvar.yaml
  updateRules: ../source/mvu/update-rules.yaml
  variableList: ../source/mvu/variable-list.md
  outputFormat: ../source/mvu/output-format.md
  variableListPath: stat_data
  hideRegex: true
  beautifyRegex: true
html:
  statusbar:
    enabled: true
    mode: safe_macro
    html: ../source/html/statusbar.html
    css: ../source/html/statusbar.css
    variablePaths:
      - stat_data.角色A.好感度
regex:
  scripts: ../source/regex/scripts.yaml
tavernHelper:
  scripts: ../source/tavern-helper/scripts.yaml
ejs:
  enabled: true
  preprocess:
    file: ../source/ejs/preprocess.ejs
    position: before_char
    order: 14500
    depth: 0
  entries:
    - id: stage-controller
      file: ../source/ejs/stage-controller.ejs
      role: controller
      enabled: true
      position: at_depth
      order: 16000
      depth: 0
      conditionVariables:
        - stat_data.世界.阶段
      complexity: dynamic_text
```

## Tavern Helper scripts.yaml

```yaml
- id: local-helper
  name: 本地助手脚本
  contentFile: helper.js
  enabled: false
  info: 启用前确认来源
  allowExternal: false
  buttons:
    - name: 打开面板
      visible: true
  data: {}
```

规则：

- `contentFile` 必须指向 `source/tavern-helper/` 内文件。
- 默认 `allowExternal: false`，脚本内出现 URL 会报错。
- 如确需外链，必须 `allowExternal: true` 并在 `plan.md` 记录来源与风险。
- 不要把提示词、破限文本或思维链说明当成 Tavern Helper 脚本。

## 自查清单

- [ ] card description 是空字符串。
- [ ] 长内容都在 source 文件中。
- [ ] worldbook entries 都引用 `source/entries/*`。
- [ ] 绿灯条目有 keys。
- [ ] 双递归全部开启。
- [ ] assets 引用目录正确。
- [ ] Tavern Helper 外链已明确记录风险或未使用。
