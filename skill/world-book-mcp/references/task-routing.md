# 任务路由与澄清规则

> 何时阅读：拿到世界书 / 角色卡 / MVU / HTML / EJS / JSON 修改需求时，先用本页判断任务类型与需要确认的问题。

## 任务类型

- `original_character_card`：原创角色卡，包含人设、开场白、可选 MVU/HTML/EJS。
- `derivative_extraction`：基于原作文本、小说、游戏、wiki、网页摘要等提取设定。
- `worldbuilding_only`：纯世界观设计或世界书导出。
- `item_ability_equipment`：物品、能力、装备、武器、服装条目。
- `style_extraction`：文风、行文规则、叙事风格提取。
- `chapter_extraction`：章节、剧情、事件线、角色状态变化提取。
- `modify_existing`：导入并修改已有世界书或角色卡 JSON。
- `query_existing`：查询、搜索、统计已有 JSON。
- `mvu_zod`：MVU/ZOD 变量系统。
- `ejs_dynamic`：EJS 动态条目、阶段人设、getwi/getvar。
- `html_beautify`：HTML 状态栏、CSS、正则脚本、前端美化。
- `content_lint`：禁词、自查、润色、写作优化报告。

## 关键词路由

按优先级判断：

1. 出现 `EJS`、`动态条目`、`阶段条目`、`getwi`、`getvar` → `ejs_dynamic`。
2. 出现 `HTML`、`状态栏`、`美化`、`CSS`、`正则脚本`、`前端` → `html_beautify`。
3. 出现 `MVU`、`ZOD`、`变量`、`状态变量`、`initvar`、`状态栏占位符` → `mvu_zod`。
4. 出现 `禁词`、`润色`、`优化`、`扫描`、`自查`、`lint`、`违禁词` → `content_lint`。
5. 出现 `修改`、`更新`、`patch`、`补丁`、`删除条目`、`已有世界书`、`导入世界书` → `modify_existing`。
6. 出现 `查询`、`查看`、`搜索`、`统计`、`brief`、`uid` → `query_existing`。
7. 出现 `文风`、`风格提取`、`行文`、`叙事风格` → `style_extraction`。
8. 出现 `章节`、`章回`、`剧情提取`、`故事提取`、`剧情总结` → `chapter_extraction`。
9. 出现 `物品`、`道具`、`装备`、`服装`、`衣服`、`能力`、`技能`、`法术`、`武器` → `item_ability_equipment`。
10. 出现 `二创`、`原作`、`同人`、`提取`、`根据文本/资料/网页/小说/作品` → `derivative_extraction`。
11. 出现 `角色卡`、`character card`、`开场白`、`first_mes`、`alternate greeting` → `original_character_card`。
12. 否则默认为 `worldbuilding_only`。

## 原创 / 二创判断

- 明确说“原创 / 自创 / 设计 / 从零生成” → 原创。
- 明确说“二创 / 同人 / 原作 / 根据小说 / 根据文本 / 根据网页资料” → 二创。
- 同时存在原创和原作参考 → 先问用户是否为“原创为主、二创为主、混合”。

## 模糊时优先询问

可用 `request_user_decision` 把问题写入 project 的 pending decisions。

### 通用

- 这次任务是原创、二创，还是混合？
- 最终目标是世界书、角色卡，还是两者都要？

### 角色卡 / 世界书

- 卡型：单角色卡 / 多角色卡 / 纯世界书？
- 世界观类型：A 真实背景 / B 小世界 / C 大世界？
- 是否启用 MVU？是否启用 HTML 状态栏？是否启用 EJS？

### 二创提取

- 素材类型：小说 / 游戏 / wiki / web research / mixed？
- 提取维度：角色 / 世界观 / 物品能力 / 事件 / 文风 / 章节？

### 修改已有 JSON

- 修改类型：新增条目 / 更新条目 / 删除条目 / 调整顺序 / 启用禁用？
- 目标文件路径是什么？是世界书 JSON 还是角色卡 JSON？

## 使用方式

- 判断出任务类型后，去 [`workflows.md`](workflows.md) 选择对应流程。
- 如果判断不唯一，先按“模糊时优先询问”列出问题。
- 用户确认后，用 `request_user_decision` / `record_user_decision` 保存选择，再继续写入、校验和导出。
