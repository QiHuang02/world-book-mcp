# 任务路由与澄清规则

## 固定原则

完整创作、修改、导出任务的第二步永远是 `init_project`。只有纯咨询、纯模板示例、纯内容建议可以不初始化。

```text
用户提出需求
→ init_project
→ 根据扫描/切片结果追问
→ update_plan
→ draft update
→ validate_draft
→ generate_json
```

## 任务阶段

- `create`：原创或根据材料创建角色卡/世界书。
- `modify`：修改已有角色卡/世界书/条目/MVU/HTML/EJS。
- `query`：查询导出的 JSON 或当前 draft。
- `evaluate`：审查、lint、交付检查。

## 来源类型

- `original`：原创、自创、从零设计。
- `derivative`：根据小说/文本/wiki/游戏/网页资料提取。
- `mixed`：原创与参考资料混合。
- `modify_existing`：当前目录已有 SillyTavern JSON，或用户要求修改已有 JSON。

## 输出目标

必须确认并写入 `.worldbook/plan.md`：

- `worldbook`
- `character_card`
- `both`

## 修改已有 JSON

命中关键词：修改、更新、已有角色卡、已有世界书、导入、第三方角色卡、别人做的卡、patch、补丁。

新流程：

```text
init_project(scan_existing=true, import_strategy="auto")
→ MCP 自动切片已有 JSON，包括世界书、profile、greetings、MVU、HTML、EJS、regex
→ AI 查看切片摘要并询问修改目标
→ update_plan 记录修改计划
→ update_draft_field(s)
→ validate_draft
→ generate_json
```

不要再引导使用旧 patch 工具。

## 需要追问的问题

在 `init_project` 后，根据扫描结果精简提问：

- 最终导出世界书、角色卡还是 both？
- 是覆盖原文件还是输出新文件？
- 是否启用/保留已有 MVU？
- 是否启用/保留已有 HTML 状态栏？
- 是否启用/保留已有 EJS 动态条目？
- 是否需要保留第三方 regex scripts？
- 文风、角色关系、世界观是否有额外要求？

## 增强资产判断

用户未要求时不要主动新增 MVU/HTML/EJS；但如果 `init_project` 从第三方角色卡中识别到已有资产，应询问是否保留、修改或禁用。

关键词：

- MVU/ZOD/schema/initvar/变量更新 → `mvu_schema` + `mvu_update_rules`
- HTML/状态栏/StatusPlaceHolderImpl/regex/美化 → `html_statusbar` + `html_regex`
- EJS/getwi/getvar/阶段/条件渲染 → `ejs_entry`
