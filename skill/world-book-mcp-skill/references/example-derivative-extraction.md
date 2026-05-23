# 示例：根据文本/小说提取并导出

```text
init_project
→ 宿主 AI 阅读用户提供文本/文件，并在对话中整理结构化事实
→ update_plan 记录素材来源、任务类型、输出目标和用户决策
→ create_draft_slice(draft_type="worldbook_entry", id="world-summary")
→ update_draft_field(id="world-summary", field_path="content", value="...")
→ create_draft_slice 为角色、事件、物品、场景创建切片
→ update_draft_fields 逐字段填写 entryType / keys / constant / position / order / content
→ 如需角色卡：create_draft_slice(character_profile) + create_draft_slice(character_greetings)
→ validate_draft(scope="all")
→ generate_json(target="worldbook" | "character_card" | "both")
```

不要把整篇原文塞进 MCP；MCP 保存的是 plan、draft、校验结果和最终 JSON。
