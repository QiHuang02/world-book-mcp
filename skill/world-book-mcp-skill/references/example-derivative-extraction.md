# 示例：根据文本/小说提取并导出

```text
init_project(output="worldbook"|"character_card"|"both", source="derivative", opening?若角色卡)
→ 阅读用户提供文本/文件，并在对话中整理结构化事实与 sourceRefs
→ update_plan 记录素材来源、source、output、章节行号索引和用户决策
→ 按 derivative-extraction.md 整理角色/世界/事件提取表
→ create_draft_slice(draft_type="entry", id="world-summary")
→ update_entry_content(id="world-summary", content=世界总纲 XML+YAML)
→ update_entry_config(id="world-summary", changes={ entryType:"world_summary", constant:true, position:"before_char", order:1 })
→ create_draft_slice(draft_type="entry", id="...") 为角色、事件、物品、场景创建切片
→ 每条分别调用 update_entry_content / update_entry_config
→ 如需角色卡：update_character_profile + update_character_greetings
→ validate_project(scope="all")
→ 按 content-rules.md 做禁词/八股/具体性自查
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., target="worldbook" | "character_card" | "both")
```

不要把整篇原文塞进 MCP；MCP 保存的是 plan、draft slices、结构校验结果、build manifest 和最终 JSON。内容提取表可摘要写入 plan，详细分析留在对话或外部材料中。
