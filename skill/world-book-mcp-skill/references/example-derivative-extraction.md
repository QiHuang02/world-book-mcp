# 示例：根据文本/小说提取并导出

```text
init_project
→ 宿主 AI 阅读用户提供文本/文件，并在对话中整理结构化事实与 sourceRefs
→ update_plan 记录素材来源、任务类型、输出目标、章节行号索引和用户决策
→ 宿主 AI 按 derivative-extraction.md 整理角色/世界/事件提取表
→ create_draft_slice(draft_type="entry", id="world-summary")
→ update_draft_fields(draft_type="entry", id="world-summary", changes={ entryType:"world_summary", content, constant:true, position:"before_char", order:1 })
→ create_draft_slice(draft_type="entry", id="...") 为角色、事件、物品、场景创建切片
→ update_draft_fields 逐字段填写 entryType / keys / constant / position / order / content
→ 如需角色卡：update_character_profile + update_character_greetings
→ validate_draft(scope="all")
→ 宿主 AI 按 content-rules.md 做禁词/八股/具体性自查
→ review_project
→ check_delivery(export_target)
→ generate_json(target="worldbook" | "character_card" | "both")
```

不要把整篇原文塞进 MCP；MCP 保存的是 plan、draft、结构校验结果和最终 JSON。内容提取表可摘要写入 plan，详细分析留在对话或外部材料中。
