---
name: world-book-mcp-skill
description: 使用 world-book-mcp v5 创建、修改、续写、导入、修复、校验并生成 SillyTavern 世界书、角色卡、chara_card_v3、Tavern JSON；适用于酒馆、世界书、角色卡、plan.md、draft YAML、source 文件、MVU、HTML 状态栏、regex、EJS、validate_project、validate_mvu、generate_json、check_delivery 等工作流。
---

# world-book-mcp v5

以 world-book-mcp 工具输出为唯一事实源。不要手写最终 `.card.json` 或 `.worldbook.json`；最终 JSON 必须从项目 `plan.md`、draft YAML 和 `source/` 文件生成。

## 必须流程

1. 判定请求类型：新建原创/二创、导入/修复已有 JSON、断点续写、校验交付，或局部修改。
2. 只读取本次任务需要的 `references/` 文件。
3. 创建或定位项目：
   - 新项目：在知道最小项目名和输出目标后尽早调用 `init_project`，先创建可写入的 `plan.md`。
   - 已有 JSON：调用 `import_existing_json`，再用 `query_project` 检查导入结果。
   - 续写/修改：调用 `resume_project` 或 `query_project`。
4. 定稿设计或写长内容前执行 grill-me 询问。每轮只问一个关键问题，给出推荐答案，用户回答后立即用 `update_plan` 记录。
5. 长内容只能通过 `write_source_file` 写入；生成配置通过 `write_draft` 或 `configure_draft` 写入 `draft/card.yaml`、`draft/worldbook.yaml`、`draft/assets.yaml`。
6. 交付前校验：
   - 始终运行 `validate_project`。
   - 启用或修改 MVU 时运行 `validate_mvu`。
   - 仅在导入/旧项目存在可修复问题时使用 `repair_project`。
7. 用 `generate_json` 生成最终 Tavern JSON。
8. 完整交付前运行 `check_delivery`，再返回 exports 路径和校验/构建摘要。

## 硬性规则

- 所有需求、决策、风险、验收标准和验证记录都写进 `plan.md`。
- 每轮 grill-me 回答必须立即 `update_plan`，不得攒多轮后批量记录。
- 角色卡 `description` 必须严格等于 `""`；人设、背景、关系和世界事实写进世界书条目。
- 长文本、MVU、HTML、regex、EJS 正文放入 `source/`，不要内联进 draft YAML。
- 每个世界书条目都必须开启 `preventRecursion: true` 和 `excludeRecursion: true`。
- `constant: false` 的绿灯条目必须至少有一个 key。
- 不主动添加 MVU、HTML 状态栏、regex 或 EJS；只有用户明确要求或需求明显需要时才启用。EJS 依赖 MVU。
- 开场白和世界内容不得预设 `{{user}}` 的性别、外貌、行动、心理或无法确认的身份。
- 启用 HTML 状态栏时，开场白必须保留 `<StatusPlaceHolderImpl/>`。
- 校验没有 blocking error 且 exports 已生成前，不得宣称完整交付。

## 按需读取 References

- `references/workflow.md`：v5 总流程和 grill-me 顺序。
- `references/requirements.md`：需求询问和决策记录方式。
- `references/plan-md.md`：`plan.md` 结构和 `update_plan` 操作。
- `references/draft-yaml.md`：card/worldbook/assets draft 规则。
- `references/entries.md`：世界书条目结构、id、keys、order、递归和状态。
- `references/composition.md`：条目与 source 创作执行。
- `references/character.md`：角色设计、调色盘、关系、多阶段人设。
- `references/worldbuilding.md`：世界观范围、锚点、势力、规则和维度拆分。
- `references/first-message.md`：开场白与 alternate greetings 约束。
- `references/mvu.md`：MVU 五件套、schema、变量路径、preset 和更新规则。
- `references/html-statusbar.md`：状态栏 HTML/CSS、占位符和变量展示。
- `references/regex.md`：regex 脚本写法和校验规则。
- `references/ejs.md`：EJS 依赖、阶段模板、`getvar` 和预处理模式。
- `references/import-repair.md`：已有 Tavern JSON 导入映射和常见修复。
- `references/resume.md`：断点续写检查和继续工作。
- `references/rules.md`：文本质量检查和禁用写法。
- `references/validation.md`：最终校验、人工审查清单和交付门禁。

## 工具速查

| 工具 | 用途 |
| --- | --- |
| `init_project` | 创建 v5 项目、`plan.md`、draft/source/reports/exports 目录。 |
| `update_plan` | 记录需求、grill-me 回答、todo、风险、验收和验证。 |
| `query_project` | 查看项目状态、plan、draft、source、reports、exports。 |
| `resume_project` | 汇总断点续写状态和下一步。 |
| `write_source_file` / `read_source_file` | 写入/读取受控的 `source/` 文件。 |
| `write_draft` | 写入或修改 `draft/card.yaml`、`draft/worldbook.yaml`、`draft/assets.yaml`。 |
| `configure_draft` | 推导、预览或应用世界书条目配置，避免重复 id。 |
| `import_existing_json` | 从已有角色卡/世界书 JSON 创建 v5 项目。 |
| `import_nova_config` | 从 nova-creator-cli 风格 YAML config 创建项目。 |
| `repair_project` | 修复旧项目或导入项目的常见问题。 |
| `validate_project` | 校验 workspace、plan、draft/source 引用、资产、条目和 reports。 |
| `validate_mvu` | 校验 MVU schema/initvar/rules/output 的一致性和反模式。 |
| `apply_mvu_preset` | 创建原生 MVU 五件套模板并启用 draft assets。 |
| `list_mvu_variables` / `upsert_mvu_variable` / `remove_mvu_variable` / `rewrite_mvu_variables` | 查看或编辑 MVU 变量并同步五件套。 |
| `convert_mvu_path` | 转换 `stat_data.a.b`、JSON Patch 路径和 YAML 点路径。 |
| `create_ejs_stage_template` | 生成阶段人设 EJS controller 和 disabled stage entries。 |
| `update_entry_status` / `query_entries` | 维护和检查条目进度、摘要、part 和 sourceRefs。 |
| `generate_json` | 构建最终 SillyTavern exports 和 build report。 |
| `check_delivery` | 交付前检查 validation、exports、reports 和 entry status。 |
| `list_projects` | 列出 workspace 项目。 |

## 交付清单

最终回复前确认：

```text
validate_project -> 无 error
validate_mvu -> 启用 MVU 时无 error
generate_json -> 成功
reports/validation-report.md -> 存在
reports/build-report.yaml -> 存在
exports/*.json -> 存在
check_delivery -> 完整交付时通过
```

回复中列出生成的 export 路径、validation summary、build/report 路径，以及剩余非阻塞 warning 或待用户决策项。
