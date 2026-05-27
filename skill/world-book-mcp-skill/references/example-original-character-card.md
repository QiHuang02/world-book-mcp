# 示例：原创角色卡 v3 流程

```text
init_project(output="character_card", source="original", opening=...)
→ update_plan(mode="replace_section", section="1. 用户原始需求", content="...")
→ update_plan(mode="set_export_target", export_target={ type: "character_card", filename: "角色卡.json" })
→ update_character_profile(changes={ name, description:"", scenario, system_prompt, include_worldbook:true, worldbook_name:"角色世界书" })
→ create_draft_slice(draft_type="entry", id="character-basic")
→ update_entry_content(id="character-basic", content=角色基础 XML+YAML)
→ update_entry_config(id="character-basic", changes={ entryType:"character_basic", characterName, constant:true, position:"after_char", order:10, keys })
→ create_draft_slice(draft_type="entry", id="character-personality")
→ update_entry_content(id="character-personality", content=性格 XML+YAML)
→ update_entry_config(id="character-personality", changes={ entryType:"character_personality", characterName, constant:true, position:"after_char", order:20, keys })
→ update_character_greetings(changes={ first_mes, alternate_greetings })
→ 可选：create_draft_slice(draft_type="mvu"|"html"|"regex"|"ejs", id="...")
→ validate_project(scope="all")
→ 按 content-rules.md 做禁词/八股/具体性自查
→ build_assets(target="all")
→ validate_project(scope="delivery", build_id=...)
→ generate_json(build_id=..., target="character_card")
```

原则：角色复杂设定进入 `entry`；角色卡 profile 只保存酒馆卡字段且 `description` 为空；MVU/HTML/regex/EJS 全部通过对应 v3 slice 和语义化工具维护。
