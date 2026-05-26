# 示例：原创角色卡新流程

```text
init_project(kind="character_card")
→ update_plan(mode="replace_section", section="1. 用户原始需求", content="...")
→ update_plan(mode="set_export_target", export_target={ type: "character_card", filename: "角色卡.json" })
→ update_character_profile(changes={ name, description:"", scenario, system_prompt, include_worldbook:true, worldbook_name:"角色世界书" })
→ create_draft_slice(draft_type="entry", id="character-basic")
→ update_draft_fields(draft_type="entry", id="character-basic", changes={ content, entryType:"character_basic", characterName, constant:true, position:"after_char", order:10 })
→ create_draft_slice(draft_type="entry", id="character-personality")
→ update_draft_fields(draft_type="entry", id="character-personality", changes={ content, entryType:"character_personality", characterName, constant:true, position:"after_char", order:20 })
→ update_character_greetings(changes={ first_mes, alternate_greetings })
→ 可选：create_draft_slice(draft_type="mvu"|"html"|"ejs", id="...")
→ validate_draft(scope="character_card")
→ validate_draft(scope="worldbook")
→ 宿主 AI 按 content-rules.md 做禁词/八股/具体性自查
→ build_assets(target="all")
→ review_project
→ check_delivery(export_target="character_card")
→ generate_json(target="character_card")
```

原则：角色复杂设定进入 `entry`；角色卡 profile 只保存酒馆卡字段且 `description` 为空；MVU/HTML/EJS 全部通过 `mvu/html/ejs` draft 化。
