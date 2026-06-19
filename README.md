# skilldb

CLI, TypeScript SDK, and **MCP Server** for [SkillDB](https://skilldb.dev) — discover, install, and manage AI agent skills.

5,000+ expert skills across 327 packs for Claude Code, Cursor, Windsurf, and any MCP-compatible AI tool.

> **Open source for transparency.** This is the full source for the [`skilldb`](https://www.npmjs.com/package/skilldb) npm package — the CLI and MCP server that run **on your machine** and handle **your API key**. It's published to npm via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, with provenance) so the published artifact is verifiably built from this repo. Audit away, and PRs welcome. MIT licensed.

## MCP Server (NEW in v0.4.0)

Connect SkillDB directly to your AI coding tool via the Model Context Protocol:

```bash
# Step 1: Install globally (one time)
npm install -g skilldb

# Step 2: Get your free API key at https://skilldb.dev/api-access

# Step 3: Add to Claude Code (with API key for full content)
claude mcp add skilldb -- skilldb-mcp --api-key sk_live_YOUR_KEY
```

> **⚠️ Without an API key**, you can search and browse skills (metadata only).
> **With a free API key**, you get full skill content — the actual markdown instructions your agent uses.
> Get your key in 30 seconds at [skilldb.dev/api-access](https://skilldb.dev/api-access).

**Cursor** — add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "skilldb": {
      "command": "skilldb-mcp"
    }
  }
}
```

**Windsurf** — add to `mcp_config.json`:
```json
{
  "mcpServers": {
    "skilldb": {
      "command": "skilldb-mcp",
      "args": ["--api-key", "sk_live_xxx"]
    }
  }
}
```

Once connected, your AI assistant can search and load skills natively. Just ask:
- *"Search SkillDB for React performance patterns"*
- *"Load the code review skill"*
- *"What skills should I use for this project?"*

**5 tools exposed:** `skilldb_search`, `skilldb_get`, `skilldb_list`, `skilldb_suggest`, `skilldb_recommend`

## Quick Start (CLI)

```bash
# Search for skills (with inline preview)
npx skilldb search "code review"

# Install a skill pack
npx skilldb add software-skills

# Activate a smart profile (only loads what you need)
npx skilldb use frontend

# Or auto-detect from your project
npx skilldb use auto
```

## Install

```bash
npm install -g skilldb
```

Or use `npx skilldb` without installing.

## The Memory Problem (And How We Solve It)

Loading 500 skills into your agent's context is worse than loading the right 5. SkillDB uses a **3-layer architecture** to manage this:

```
.skilldb/
├── skills/          ← Full cache (everything downloaded)
├── active/          ← Active profile (what your agent sees — 5-15 focused skills)
├── slim/            ← Compressed cheat sheets (10x smaller)
├── config.json      ← Profile + budget settings
└── manifest.json    ← What's installed
```

Your CLAUDE.md or .cursorrules points at `.skilldb/active/`, not the full cache. The agent gets focused, relevant skills — not noise.

## CLI Commands

### Core

#### `skilldb init`

Detect your IDE (Claude Code, Cursor, Codex CLI, OpenClaw), create `.skilldb/`, and add integration config.

```bash
skilldb init
```

#### `skilldb search <query>`

Search skills by keyword. Shows inline slim preview so you know what you're getting before downloading.

```bash
skilldb search "debugging"
skilldb search "api design" --category "Technology & Engineering"
skilldb search "testing" --limit 10
```

#### `skilldb add <pack>`

Download a skill pack to local cache. Idempotent — skips already-cached skills.

```bash
skilldb add software-skills
skilldb add autonomous-agent-skills
skilldb add vibe-coding-security-skills
```

#### `skilldb get <id>`

Download a single skill.

```bash
skilldb get software-skills/code-review
```

#### `skilldb info <id>`

Show metadata, slim summary, and full preview for a skill.

```bash
skilldb info software-skills/code-review
```

#### `skilldb list`

List available categories, packs, and skills.

```bash
skilldb list
skilldb list --category "Autonomous Agents"
skilldb list --pack software-skills
```

#### `skilldb login`

Save your API key for authenticated access.

```bash
skilldb login
```

### Smart Loading

#### `skilldb use <profile>`

Activate a focused profile — only loads relevant skills into `.skilldb/active/`.

```bash
skilldb use frontend          # React, testing, web-polish, accessibility
skilldb use backend           # API design, databases, security, performance
skilldb use devops            # Kubernetes, Docker, CI/CD, monitoring
skilldb use security          # Trust audit, input validation, credentials
skilldb use data              # SQL, pipelines, analytics, visualization
skilldb use fullstack         # Frontend + backend combined
skilldb use ai-agent          # Autonomous agent meta-skills
skilldb use auto              # Auto-detect from your project files
skilldb use --list            # Show available profiles
skilldb use --current         # Show active profile
skilldb use none              # Deactivate (clear active/)
```

`auto` mode scans your `package.json`, file extensions, and imports to recommend the right profile.

#### `skilldb budget`

Set a maximum context budget so your agent doesn't get overloaded.

```bash
skilldb budget                # Show current usage
skilldb budget set 5000       # Max 5,000 lines
skilldb budget set 50k        # Max 50,000 tokens
skilldb budget optimize       # Re-rank and trim active skills to fit
```

#### `skilldb slim`

Generate compressed cheat-sheet versions of skills (~30 lines instead of 300).

```bash
skilldb slim                  # Slim all active skills
skilldb slim software-skills  # Slim a specific pack
skilldb slim --ratio 0.3      # Keep 30% of content
```

### Management

#### `skilldb update`

Check for newer versions of installed skills and update them.

```bash
skilldb update                # Update everything
skilldb update software-skills  # Update one pack
```

#### `skilldb remove`

Uninstall skills from local cache.

```bash
skilldb remove software-skills/code-review    # Remove single skill
skilldb remove software-skills                # Remove entire pack
skilldb remove --unused                       # Remove skills not in active profile
```

#### `skilldb doctor`

Health check and audit of your skill setup.

```bash
skilldb doctor
```

Shows: outdated skills, unused skills, missing dependencies, budget status, coverage gaps.

#### `skilldb stats`

Local statistics dashboard.

```bash
skilldb stats
```

Shows: installed count, total lines, tokens, active profile, categories covered.

#### `skilldb diff <id>`

Compare your local (possibly customized) version with the latest remote.

```bash
skilldb diff software-skills/code-review
skilldb diff                  # Diff all installed
```

### Sharing & Export

#### `skilldb export`

Export your setup for sharing or IDE integration.

```bash
skilldb export claude         # CLAUDE.md snippet with skill references
skilldb export cursor         # .cursorrules block
skilldb export profile        # Shareable .skilldb-profile.json
skilldb export inject <id>    # Print skill to stdout (for piping)
```

#### `skilldb recommend`

Scan your project and get personalized skill recommendations.

```bash
skilldb recommend             # Analyze project and suggest
skilldb recommend --install   # Auto-install recommendations
```

## SDK Usage

```typescript
import { createClient } from 'skilldb';

const db = createClient(); // auto-loads key from env/config

// Search with slim previews
const results = await db.search('code review');
for (const skill of results.skills) {
  console.log(skill.title);
  console.log(skill.slim); // Quick summary
}

// Get full skill content
const skill = await db.get('software-skills/code-review.md');
console.log(skill.content);

// List with filters
const listing = await db.list({ category: 'Autonomous Agents', limit: 10 });
```

## Authentication

The SDK and CLI resolve your API key in order:

1. `SKILLDB_API_KEY` environment variable (CI-friendly)
2. `.skilldbrc` in project root (project-specific)
3. `~/.skilldbrc` in home directory (user-wide)

Browsing and searching works without authentication. Full skill content requires a Pro or Studio key.

## Profiles

Built-in profiles map to curated skill sets:

| Profile | Skills loaded | Best for |
|---------|--------------|----------|
| `frontend` | react-patterns, web-polish, testing, accessibility | React/Vue/Angular apps |
| `backend` | api-design, databases, security, performance | Node/Python/Go services |
| `devops` | kubernetes, docker, ci-cd, monitoring, cloud | Infrastructure & deployment |
| `security` | trust-audit, input-validation, credentials, hardening | Security review & hardening |
| `data` | sql, pipelines, analytics, visualization | Data engineering & analysis |
| `fullstack` | frontend + backend combined | Full-stack applications |
| `ai-agent` | autonomous-agent-skills, task-decomposition, planning | Building AI agents |
| `auto` | Detected from project | Any project |

## Requirements

- Node.js >= 18

## License

MIT
