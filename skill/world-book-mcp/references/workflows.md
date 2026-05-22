# 7 类标准工作流

> 何时阅读：当 SKILL.md 概览不够、需要照搬完整调用顺序时翻这里。每个工作流都已经按"主 AI 在哪步介入"标注。

---

## 1. 从文本生成世界书

```text
get_worldbook_workflow（task_type=from_text）
→ init_project（已有 project_id 可跳过）   # 空白目录/新项目起手
→ ingest_text_source                      # 保存原文
→ create_extraction_outline               # 拿提取模板
→ 主 AI 阅读原文，按模板抽取结构化事实
→ submit_extraction_result                # 提交事实
→ plan_worldbook_entries                  # 规划条目
→ 主 AI 编写条目正文
→ upsert_worldbook_entry / upsert_worldbook_entries  # 简化输入保存 draft
→ validate_worldbook_draft                # 校验
→ 如有问题：update_worldbook_draft_entries  # 局部修复
→ generate_worldbook_json                 # 导出
→ query_worldbook                         # 抽查
```

## 2. 从网页摘要生成世界书

```text
get_worldbook_workflow（task_type=from_web_research）
→ init_project（已有 project_id 可跳过）   # 空白目录/新项目起手
→ 主 AI 在外部完成网页搜索（MCP 不联网）
→ 主 AI 整理搜索摘要 + facts
→ ingest_web_research                     # 保存摘要
→ create_extraction_outline
→ 主 AI 从摘要中抽取结构化事实
→ submit_extraction_result
→ plan_worldbook_entries
→ 主 AI 编写条目正文
→ upsert_worldbook_entry / upsert_worldbook_entries
→ validate_worldbook_draft
→ generate_worldbook_json
→ query_worldbook
```

## 3. 从世界书 draft 生成角色卡

```text
validate_worldbook_draft                  # 先把世界书 draft 跑通
→ 主 AI 编写 first_mes 和 alternate_greetings
→ upsert_character_profile                # 简化字段保存角色卡配置
→ validate_character_card_config
→ generate_character_card_json
→ query_character_card
```

角色卡生成前一定先完成世界书 draft，因为当前规范推荐 `description` 为空，角色信息全部放入内嵌世界书。导出角色卡时，同一角色的 `character_basic` 与 `character_personality` 会自动聚合为一个内嵌条目。

## 4. 生成带 MVU/ZOD 的角色卡

```text
validate_worldbook_draft
→ create_mvu_schema_template
→ 主 AI 调整 schema_script / initvar / update_rules
→ submit_mvu_config
→ validate_mvu_config
→ build_mvu_assets                        # 可选：预览将合并的资产
→ 主 AI 填写带 <StatusPlaceHolderImpl/> 的开场白
→ upsert_character_profile
→ validate_character_card_config
→ generate_character_card_json            # 自动合并 MVU 条目、正则、Tavern Helper
→ query_character_card
```

启用 MVU 后，开场白末尾必须含 `<StatusPlaceHolderImpl/>`，否则状态栏会落空。

## 5. 生成带 HTML 美化的角色卡

```text
validate_worldbook_draft
→ create_html_beautify_template
→ 主 AI 调整 statusbar.html 或 global.regex_scripts
→ submit_html_beautify_config
→ validate_html_beautify_config
→ build_html_beautify_assets              # 可选预览
→ 主 AI 填写带 <StatusPlaceHolderImpl/> 的开场白
→ upsert_character_profile
→ validate_character_card_config
→ generate_character_card_json            # 自动合并 regex scripts
→ query_character_card
```

HTML 状态栏通常配合 MVU 使用，可以单独生成全局 regex assets。CSS 必须用作用域 class（如 `.wbm-statusbar`），不要使用 `body` / `html` / `*` 等全局选择器。

## 6. 生成带 EJS 动态内容的角色卡

```text
validate_worldbook_draft
→ create_mvu_schema_template              # EJS 必须先有 MVU
→ submit_mvu_config
→ validate_mvu_config
→ create_ejs_template
→ 主 AI 调整 EJS 控制器和阶段条目内容
→ submit_ejs_config
→ validate_ejs_config
→ build_ejs_entries                       # 可选预览
→ upsert_character_profile
→ validate_character_card_config
→ generate_character_card_json            # 自动把 EJS entries 合并进内嵌世界书
→ query_character_card
```

EJS 规则：

- 变量路径必须以 `stat_data` 开头。
- 控制器条目通常 `enabled=true`、`constant=true`，用 `await getwi('条目名')` 加载阶段条目。
- 被 `getwi()` 加载的阶段条目应设为 `enabled=false`。
- 读取阶段变量用 `var` + `typeof`，不要用 `const` / `let`，避免重复声明报错。

## 7. 修改已有世界书

```text
将目标 JSON 放在当前工作目录内
→ import_worldbook_json                   # 导入为 project draft
→ create_worldbook_patch                  # 创建修改计划（不写文件）
→ preview_worldbook_patch                 # 看 diff + 校验
→ apply_worldbook_patch                   # 应用 + 校验 + 备份 + 导出新 JSON
→ query_worldbook
```

`apply_worldbook_patch` 默认会在目标文件存在时备份到 `.worldbook/backups/`，覆盖前要求 `overwrite=true`。校验失败时不会写文件。

## 输出位置

- 世界书：默认导出到当前工作目录的 `<名称>.json`
- 角色卡：默认导出到当前工作目录的 `<角色名>.json`
- patch 备份：`.worldbook/backups/`
- 项目状态：`.worldbook/project.json`
- draft 分片：`.worldbook/draft/*.json`
