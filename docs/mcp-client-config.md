# MCP 客户端配置示例

本文提供 `world-book-mcp` 的常见 MCP 客户端配置示例。

## 构建后运行

先构建项目：

```bash
npm run build
```

然后在 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "world-book-mcp": {
      "command": "node",
      "args": ["D:/Work/world-book-mcp/dist/index.js"]
    }
  }
}
```

## 开发模式运行

如果希望直接运行 TypeScript 源码，可使用：

```json
{
  "mcpServers": {
    "world-book-mcp-dev": {
      "command": "npx",
      "args": ["tsx", "D:/Work/world-book-mcp/src/index.ts"]
    }
  }
}
```

## npm 全局安装后的运行方式

如果之后将本项目作为 npm 包安装，并且 `world-book-mcp` 已在 PATH 中，可以使用：

```json
{
  "mcpServers": {
    "world-book-mcp": {
      "command": "world-book-mcp"
    }
  }
}
```

## Windows 路径注意事项

在 JSON 配置里，Windows 路径建议使用正斜杠：

```json
"D:/Work/world-book-mcp/dist/index.js"
```

也可以使用双反斜杠：

```json
"D:\\Work\\world-book-mcp\\dist\\index.js"
```

不要使用单反斜杠，因为 JSON 会把它当作转义字符。

## 验证步骤

1. 运行：

```bash
npm run build
```

2. 重启 MCP 客户端。
3. 检查 tools 列表中是否出现以下核心 tools：
   - `get_worldbook_workflow`
   - `get_tool_usage_guide`
   - `ingest_text_source`
   - `ingest_web_research`
   - `plan_worldbook_entries`
   - `validate_worldbook_draft`
   - `generate_worldbook_json`
   - `create_character_card_template`
   - `generate_character_card_json`
   - `import_worldbook_json`
   - `apply_worldbook_patch`
4. 首先调用：

```text
get_worldbook_workflow
```

推荐参数：

```json
{
  "task_type": "from_text",
  "wants_character_card": true
}
```

如果能返回包含世界书和角色卡的推荐工作流，说明 MCP server 已正确启动。

## 建议的首次测试

### 1. 查询 tool 用法

调用：

```text
get_tool_usage_guide
```

参数：

```json
{
  "tool": "submit_extraction_result"
}
```

如果返回用途、必填字段、示例输入和下一步 tools，说明指南 tool 正常。

### 2. 跑通最短世界书流程

1. `ingest_text_source`
2. `create_extraction_outline`
3. `submit_extraction_result`
4. `plan_worldbook_entries`
5. `create_worldbook_draft_template`
6. `draft_worldbook_entries`
7. `validate_worldbook_draft`
8. `generate_worldbook_json`

### 3. 跑通角色卡流程

在世界书 draft 校验通过后：

1. `create_character_card_template`
2. `submit_character_card_config`
3. `validate_character_card_config`
4. `generate_character_card_json`
5. `query_character_card`

## 输出目录

- 世界书 JSON：`output/exports/`
- 角色卡 JSON：`output/exports/cards/`
- patch 备份：`output/exports/backups/`
- MCP 项目状态：`output/projects/`
