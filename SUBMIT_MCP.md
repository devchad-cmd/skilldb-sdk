# SkillDB MCP Server — Registry Submissions

## 1. Smithery (smithery.ai)

### Option A: CLI (recommended)
```bash
# Get API key from https://smithery.ai/account/api-keys
npx @smithery/cli mcp publish "npx -p skilldb skilldb-mcp" \
  -n "latentsmurf/skilldb" \
  --config-schema '{"type":"object","properties":{"apiKey":{"type":"string","description":"SkillDB API key (optional)"}},"required":[]}'
```

### Option B: Web submission
1. Go to https://smithery.ai
2. Sign in with GitHub (latentsmurf)
3. Click "Publish" or go to dashboard
4. Fill in:
   - **Name:** latentsmurf/skilldb
   - **Display Name:** SkillDB — AI Agent Skills Library
   - **Description:** Search, browse, and load 5,000+ expert skills for AI coding agents. 327 packs across 24 categories covering code review, debugging, security, React, DevOps, and more.
   - **Command:** `npx -p skilldb skilldb-mcp`
   - **Config Schema:** `{"type":"object","properties":{"apiKey":{"type":"string","description":"SkillDB API key (optional — metadata works without auth)"}},"required":[]}`
   - **Homepage:** https://skilldb.dev
   - **Repository:** https://github.com/latentsmurf/SkillDB
   - **Categories:** development, ai, documentation, productivity

---

## 2. LobeHub (lobehub.com/mcp)

Submit via their GitHub repo:
1. Go to https://github.com/lobehub/lobe-chat-plugins
2. Fork the repo
3. Add `skilldb.json` to `plugins/` directory:

```json
{
  "identifier": "skilldb",
  "name": "SkillDB",
  "description": "Search, browse, and load 5,000+ expert AI agent skills. 327 packs covering code review, security, React patterns, DevOps, and more.",
  "homepage": "https://skilldb.dev",
  "repository": "https://github.com/latentsmurf/SkillDB",
  "type": "mcp",
  "command": {
    "command": "npx",
    "args": ["skilldb-mcp"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "SkillDB API key (optional)"
      }
    }
  },
  "tools": [
    { "name": "skilldb_search", "description": "Search 5,000+ AI agent skills by keyword" },
    { "name": "skilldb_get", "description": "Get full skill content by ID" },
    { "name": "skilldb_list", "description": "Browse skills with filters" },
    { "name": "skilldb_suggest", "description": "Autocomplete skill names" },
    { "name": "skilldb_recommend", "description": "Recommend skills for your tech stack" }
  ],
  "tags": ["ai", "skills", "development", "claude", "cursor", "mcp"],
  "author": "SkillDB",
  "version": "0.4.1"
}
```
4. Open a PR

---

## 3. MCP.so (mcp.so)

Submit at: https://mcp.so/submit
- **Name:** SkillDB
- **npm package:** skilldb
- **Command:** `npx -p skilldb skilldb-mcp`
- **Description:** 5,000+ expert skills for AI coding agents

---

## 4. Other Registries

- **mcpmarket.com** — Submit at https://mcpmarket.com/submit
- **glama.ai/mcp** — Submit at https://glama.ai/mcp/submit
- **DeepWiki** — Auto-indexes from GitHub

---

## Verification

After submission, verify the MCP server works:
```bash
# Test initialization
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | npx -p skilldb skilldb-mcp

# Test in Claude Code
claude mcp add skilldb -- npx -p skilldb skilldb-mcp
# Then ask: "Search SkillDB for debugging skills"
```
