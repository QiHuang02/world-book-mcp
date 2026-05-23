# 流程路由树与标准工作流

> 何时阅读：当 SKILL.md 概览不够、需要判断任务路径或参考调用顺序时翻这里。本页给出常用流程，可按用户目标裁剪步骤。

---

## 流程路由树

### 第 0 层：任务意图

先判断用户真正要做什么：

- **新建**：从零生成世界书 / 角色卡 / 资产。通常 `init_project` 起手；它会创建 `.worldbook/draft/`，并在根目录没有酒馆格式 JSON 时创建模板 JSON。
- **修改已有**：已有世界书 JSON 走 `import_worldbook_json → create_worldbook_patch → preview_worldbook_patch → apply_worldbook_patch`；导入会先切片为 `.worldbook/draft/*.json`，修改作用于 draft，合并导出后 draft 继续保留。
- **查询**：已有世界书用 `query_worldbook`；已有角色卡用 `query_character_card`。
- **审查 / lint**：单段内容用 `lint_worldbook_content`；项目级用 `lint_project_content`、`create_final_review_report`、`create_delivery_checklist`。
- **导出**：已有 draft/config 时直接 `validate_* → generate_worldbook_json` 或 `generate_character_card_json`。
- **只做素材提取**：只需要结构化报告时，可停在 `submit_extraction_result` / `submit_derivative_extraction_outline`，不导出 JSON。

### 第 1 层：来源类型

判断设定来源与输入载体：

- **原创**：用户口述、笔记、设定要求；可以用 `create_worldbuilding_design_template` / `create_worldbuilding_outline` 辅助补齐。
- **同人 / 二创**：必须有用户提供的原文、wiki/资料摘要、本地文件内容，或用户明确允许对话助手联网搜索后在对话内整理资料；不要凭空脑补原作事实。
- **已有 JSON 改造**：世界书 JSON 用 `import_worldbook_json`；角色卡 JSON 用 `import_character_card_json`。
- **输入载体**：
  - 用户口述 / 粘贴文本：宿主 AI 在对话内阅读并整理事实。
  - 本地文件文本：宿主 AI 先读取文件内容，再在对话内整理事实。
  - 网络搜索摘要：宿主 AI 外部搜索并整理 facts 与来源 URL。
  - 已有世界书 JSON：`import_worldbook_json`。
  - 已有角色卡 JSON：`import_character_card_json`，查询用 `query_character_card`。

MCP 不保存原始素材或网页摘要；需要持久化的成果写入结构化 extraction、draft、角色卡配置或导出 JSON。

### 第 2 层：产物类型

根据用户要交付的东西选择路径：

- **纯世界书**：`create_worldbook_draft_entry` / `create_worldbook_draft_entries` → `update_worldbook_draft_field` / `update_worldbook_draft_fields` → `confirm_worldbook_draft_complete` → 内容与配置检查 → `generate_worldbook_json`。
- **单人角色卡**：`create_worldbook_draft_entry` / `create_worldbook_draft_entries` → `update_worldbook_draft_field` / `update_worldbook_draft_fields` → `upsert_character_profile` → `validate_character_card_config` / `validate_greetings` → 内容与配置检查 → `generate_character_card_json`。
- **多人角色卡**：角色条目独立分片，导出角色卡时按 `characterName/name/comment` 聚合。
- **世界书 + 角色卡**：先导出/校验世界书 draft，再生成角色卡；必要时分别 `generate_worldbook_json` 与 `generate_character_card_json`。
- **资产-only**：MVU/HTML/EJS 可先 `create_*_template → submit_*_config → build_*_assets` 预览，不一定导出角色卡。
- **只要提取报告**：停在 extraction/outline/profile，不调用 generate。

### 第 3 层：角色卡策略

- **单人卡**：默认不强制内嵌世界书；若人设复杂、需要 MVU/HTML/EJS 或用户要求完整卡，使用角色卡内嵌世界书承载条目。
- **固定多角色卡**：每个核心角色有独立 `character_basic` / `character_personality`，显式传 `character_name` 避免串组。
- **动态创建角色规则**：把角色创建、切换、关系规则写入世界书条目，通常更接近系统驱动/世界书-only。

### 第 4 层：提取焦点

按用户目标选择提取维度：

- 角色：`create_extraction_outline` 或 `create_derivative_extraction_template`。
- 世界观：`create_worldbuilding_outline` / `create_worldbuilding_design_template`。
- 物品 / 装备 / 能力：`validate_item_entry`，再 `create_worldbook_draft_entry` 创建模板并用 `update_worldbook_draft_field` 填充字段。
- 事件 / 场景 / 规则：作为 `event` / `scene` / `other` entry 写入。
- 文风：`create_style_extraction_template → submit_style_profile → build_style_worldbook_entries`。
- 章节 / 故事线：`create_chapter_extraction_template → build_chapter_worldbook_entries`；二创长文也可用 `submit_derivative_extraction_outline` 的 `chapter_index`。
- 关系：角色条目正文中结构化描述，或作为关系规则条目写入。

### 第 5 层：增强资产

判断是否需要：用户未明确要求时，不主动追加 MVU、HTML 或 EJS。

- **MVU/ZOD**：`create_mvu_schema_template → submit_mvu_config → validate_mvu_config → build_mvu_assets`。
- **HTML 状态栏 / Regex scripts**：`create_html_beautify_template` 或 `create_html_regex_pair_template`，再 `submit_html_beautify_config` / `validate_regex_scripts`。
- **EJS 动态内容**：EJS 依赖 MVU，走 `create_ejs_template → submit_ejs_config → validate_ejs_config → build_ejs_entries`。
- **Tavern Helper**：由 MVU assets 自动合并到角色卡 extensions。

### 第 6 层：导入 / 修改已有 JSON

- **世界书 JSON**：`import_worldbook_json → create_worldbook_patch → preview_worldbook_patch → apply_worldbook_patch`。导入和导出路径必须位于当前工作目录内，导入会切片到 `.worldbook/draft/*.json`，patch 备份写入 `.worldbook/backups/`，合并导出后 draft 保留。
- **角色卡 JSON**：`import_character_card_json → create_character_card_patch → preview_character_card_patch → apply_character_card_patch`。导入会提取 profile 并将内嵌世界书切片到 `.worldbook/draft/*.json`；patch 可修改角色卡 profile、worldbook config 或内嵌世界书 draft，导出路径限制在当前工作目录内，备份写入 `.worldbook/backups/`，合并导出后 draft 保留。

---

## 标准工作流

## init_project 起手行为

`init_project` 的主职责是初始化当前目录的 `.worldbook/project.json` 和 `.worldbook/draft/`。它还会扫描当前根目录一层 `*.json`：

- 若没有发现 SillyTavern 世界书或 `chara_card_v3` 角色卡 JSON，则创建一个根目录模板 JSON。
- 若已经存在酒馆格式 JSON，则不创建模板。
- 不覆盖已有 JSON；同名普通 JSON 存在时会使用安全备用文件名。
- 返回 `root_template`，说明模板是否创建、创建路径或已有酒馆 JSON 文件列表。

## 1. 从文本生成世界书

```text
按 task-routing 判断任务类型与歧义
→ init_project（已有 project_id 可跳过）   # 空白目录/新项目起手
→ 宿主 AI 阅读用户文本/文件内容，整理结构化事实
→ create_extraction_outline               # 可选：拿提取模板
→ submit_extraction_result                # 可选：保存结构化事实
→ 宿主 AI 按 skill 规则规划条目切片
→ create_worldbook_draft_entry / create_worldbook_draft_entries # 创建切片模板
→ 对话助手 编写条目正文
→ update_worldbook_draft_field / update_worldbook_draft_fields   # 填充 entry_type / keys / content 等
→ confirm_worldbook_draft_complete                               # 确认可合并
→ lint_project_content / create_final_review_report              # 内容自查与配置检查
→ 如有问题：update_worldbook_draft_field / update_worldbook_draft_fields # 局部修复
→ generate_worldbook_json                                        # 合并导出；严格交付可设 strict_review=true
→ query_worldbook                                                # 抽查
```

## 2. 从网页资料生成世界书

```text
按 task-routing 判断任务类型与歧义
→ init_project（已有 project_id 可跳过）   # 空白目录/新项目起手
→ 在对话中完成网页搜索、来源筛选和摘要
→ 对话助手 整理 facts + 来源 URL
→ create_extraction_outline               # 可选
→ submit_extraction_result                # 可选：保存结构化事实
→ 宿主 AI 按 skill 规则规划条目切片
→ create_worldbook_draft_entry / create_worldbook_draft_entries
→ 对话助手 编写条目正文
→ update_worldbook_draft_field / update_worldbook_draft_fields
→ confirm_worldbook_draft_complete
→ lint_project_content / create_final_review_report
→ generate_worldbook_json
→ query_worldbook
```

## 3. 从世界书 draft 生成角色卡

```text
validate_worldbook_draft                  # 先把世界书 draft 跑通
→ 对话助手 编写 first_mes 和 alternate_greetings
→ upsert_character_profile                # 简化字段保存角色卡配置
→ validate_greetings
→ validate_character_card_config
→ lint_project_content / create_final_review_report
→ generate_character_card_json            # 严格交付可设 strict_review=true
→ query_character_card
```

角色卡生成前一定先完成世界书 draft，因为当前规范推荐 `description` 为空，角色信息全部放入内嵌世界书。导出角色卡时，同一角色的 `character_basic` 与 `character_personality` 会自动聚合为一个内嵌条目。

## 4. 生成带 MVU/ZOD 的角色卡

```text
validate_worldbook_draft
→ create_mvu_schema_template
→ 对话助手 调整 schema_script / initvar / update_rules
→ submit_mvu_config
→ validate_mvu_config
→ build_mvu_assets                        # 可选：预览将合并的资产
→ 对话助手 填写带 <StatusPlaceHolderImpl/> 的开场白
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
→ 对话助手 调整 statusbar.html 或 global.regex_scripts
→ submit_html_beautify_config
→ validate_html_beautify_config
→ build_html_beautify_assets              # 可选预览
→ 对话助手 填写带 <StatusPlaceHolderImpl/> 的开场白
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
→ 对话助手 调整 EJS 控制器和阶段条目内容
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

`apply_worldbook_patch` 默认会在目标文件存在时备份到 `.worldbook/backups/`，覆盖前要求 `overwrite=true`。校验失败时不会写文件；成功后 `.worldbook/draft/*.json` 保留并反映 patch 后内容。

## 8. 修改已有角色卡

```text
将目标 JSON 放在当前工作目录内
→ import_character_card_json              # 导入 profile + 内嵌世界书 draft
→ create_character_card_patch             # 修改 profile / worldbook config / 内嵌世界书
→ preview_character_card_patch            # 看 diff + 校验
→ apply_character_card_patch              # 应用 + 校验 + 备份 + 导出新 JSON
→ query_character_card
```

`apply_character_card_patch` 覆盖前同样要求 `overwrite=true`，并在目标文件存在时备份到 `.worldbook/backups/`；成功后 `.worldbook/draft/*.json` 保留并反映内嵌世界书修改结果。

## 输出位置

- 世界书：默认导出到当前工作目录的 `<名称>.json`
- 角色卡：默认导出到当前工作目录的 `<角色名>.json`
- patch 备份：`.worldbook/backups/`
- 项目状态：`.worldbook/project.json`
- draft 分片：`.worldbook/draft/*.json`
