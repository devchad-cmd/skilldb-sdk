/**
 * SkillDB MCP Server
 *
 * Model Context Protocol server that exposes SkillDB skills
 * to any MCP-compatible AI coding tool (Claude Code, Cursor,
 * Windsurf, VS Code Copilot, and 30+ others).
 *
 * Installation:
 *   claude mcp add skilldb -- npx skilldb-mcp
 *   # or with API key:
 *   claude mcp add skilldb -- npx skilldb-mcp --api-key sk_live_xxx
 *
 * Cursor (settings.json):
 *   { "mcpServers": { "skilldb": { "command": "npx", "args": ["skilldb-mcp"] } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SkillDBClient } from "./client.js";
import { resolveApiKey } from "./config.js";

// Parse CLI args for API key
const args = process.argv.slice(2);
const apiKeyIdx = args.indexOf("--api-key");
let apiKey = apiKeyIdx >= 0 ? args[apiKeyIdx + 1] : resolveApiKey();
const baseUrl = args.includes("--base-url")
  ? args[args.indexOf("--base-url") + 1]
  : undefined;

let hasApiKey = !!apiKey;
let client = new SkillDBClient({ apiKey, baseUrl });

// Warn on startup if no API key
if (!hasApiKey) {
  process.stderr.write(
    "\n⚠️  SkillDB MCP: No API key configured.\n" +
    "   You can search and browse skills, but full content requires an API key.\n" +
    "   Get a free key at: https://skilldb.dev/api-access\n" +
    "   Then use: skilldb_set_key to configure it (no restart needed)\n" +
    "   Or restart with: claude mcp remove skilldb && claude mcp add skilldb -- skilldb-mcp --api-key YOUR_KEY\n\n"
  );
}

const server = new McpServer({
  name: "skilldb",
  version: "0.7.0",
});

// ─── Tool: Set API Key (mid-session) ───
server.registerTool(
  "skilldb_set_key",
  {
    title: "Set SkillDB API Key",
    description:
      "Configure your SkillDB API key without restarting the session. Once set, all subsequent calls (search, get, list) will include full skill content. Get a free key at skilldb.dev/api-access.",
    inputSchema: z.object({
      key: z.string().describe("Your SkillDB API key (starts with sk_live_ or sk_test_)"),
    }),
  },
  async ({ key }) => {
    if (!key.startsWith("sk_")) {
      return { content: [{ type: "text", text: "Invalid key format. SkillDB API keys start with `sk_live_` or `sk_test_`. Get one at https://skilldb.dev/api-access" }], isError: true };
    }

    // Update the mutable state
    apiKey = key;
    hasApiKey = true;
    client = new SkillDBClient({ apiKey: key, baseUrl });

    // Validate the key
    try {
      const valid = await client.validate();
      if (valid) {
        return { content: [{ type: "text", text: `✅ **API key configured successfully!**\n\nAll SkillDB tools now return full skill content (instructions, patterns, best practices, code examples).\n\nTry: \`skilldb_search\` or \`skilldb_get\` to load skills with full content.` }] };
      } else {
        return { content: [{ type: "text", text: `⚠️ **Key set but validation failed.** The key may be invalid or expired. Calls will still be attempted.\n\nGet a new key at https://skilldb.dev/api-access` }] };
      }
    } catch {
      // Key set but couldn't reach the API to validate — still usable
      return { content: [{ type: "text", text: `✅ **API key set.** Couldn't validate (API may be temporarily unavailable), but the key will be used for all subsequent calls.` }] };
    }
  }
);

// ─── Tool: Search Skills ───
server.registerTool(
  "skilldb_search",
  {
    title: "Search SkillDB Skills",
    description:
      "Search the SkillDB library of 5,000+ AI agent skills by keyword. Returns skill metadata (name, description, pack, category, line count). Without an API key, only metadata is returned. With a key, full skill content is included. Get a free key at skilldb.dev/api-access.",
    inputSchema: z.object({
      query: z.string().describe("Search query (e.g. 'code review', 'react hooks', 'security')"),
      category: z.string().optional().describe("Filter by category name"),
      pack: z.string().optional().describe("Filter by pack name"),
      limit: z.number().optional().default(10).describe("Max results (1-50)"),
    }),
  },
  async ({ query, category, pack, limit }) => {
    try {
      const res = await client.search(query, {
        category,
        pack,
        limit: Math.min(limit || 10, 50),
        includeContent: !!apiKey,
      });

      const noKey = !hasApiKey;
      const text = res.skills.length === 0
        ? `No skills found for "${query}".`
        : (noKey ? `⚠️ **No API key configured** — showing metadata only. Full skill content (instructions, patterns, code examples) requires a free API key.\n👉 Get yours in 30 seconds: https://skilldb.dev/api-access\n👉 Then use \`skilldb_set_key\` with your key (no restart needed)\n\n---\n\n` : '') +
          res.skills
            .map(
              (s, i) =>
                `${i + 1}. **${s.title}** (${s.pack})\n   ${s.description}\n   ID: \`${s.id}\` | ${s.lines} lines | Category: ${s.category}` +
                (s.content ? `\n   ✅ Full content available (${s.lines} lines)` : `\n   🔒 Content locked — needs API key`)
            )
            .join("\n\n") +
          `\n\n---\nFound ${res.pagination.total} total results. Showing ${res.skills.length}.` +
          (noKey ? `\n\n🔑 **To unlock full content:** Get a free API key at https://skilldb.dev/api-access then use \`skilldb_set_key\`` : '');

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: Get Skill Content ───
server.registerTool(
  "skilldb_get",
  {
    title: "Get Skill Content",
    description:
      "Retrieve a SkillDB skill by ID. Without an API key: returns metadata + description only. With an API key: returns the FULL markdown content (instructions, patterns, best practices). Get a free key at skilldb.dev/api-access for full access.",
    inputSchema: z.object({
      id: z.string().describe("Skill ID (e.g. 'software-skills/code-review.md')"),
    }),
  },
  async ({ id }) => {
    try {
      const skill = await client.get(id);
      let text: string;
      if (skill.content) {
        text = `# ${skill.title}\n**Pack:** ${skill.pack} | **Category:** ${skill.category} | **Lines:** ${skill.lines}\n\n${skill.content}`;
      } else {
        text = `# ${skill.title}\n**Pack:** ${skill.pack} | **Category:** ${skill.category} | **Lines:** ${skill.lines}\n\n${skill.description}\n\n` +
          `---\n` +
          `⚠️ **Full content not available** — you're seeing metadata only.\n\n` +
          `To load the complete ${skill.lines}-line skill with instructions, patterns, and best practices:\n` +
          `1. Get a free API key at https://skilldb.dev/api-access\n` +
          `2. Use \`skilldb_set_key\` with your key (no restart needed)\n\n` +
          `Free keys get 100 calls/month. Pro ($9/mo) gets unlimited access.`;
      }

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: List Skills ───
server.registerTool(
  "skilldb_list",
  {
    title: "List SkillDB Skills",
    description:
      "Browse all available skills with optional filtering by category or pack. Use this to explore what's available in the SkillDB library.",
    inputSchema: z.object({
      category: z.string().optional().describe("Filter by category (e.g. 'Software Engineering', 'Security')"),
      pack: z.string().optional().describe("Filter by pack (e.g. 'software-skills', 'react-patterns-skills')"),
      sort: z.enum(["name", "-name", "lines", "-lines", "pack", "category"]).optional().describe("Sort order"),
      limit: z.number().optional().default(20).describe("Max results (1-100)"),
      offset: z.number().optional().default(0).describe("Pagination offset"),
    }),
  },
  async ({ category, pack, sort, limit, offset }) => {
    try {
      const res = await client.list({ category, pack, sort, limit, offset });

      const text = res.skills.length === 0
        ? "No skills found with those filters."
        : `## SkillDB Skills${category ? ` — ${category}` : ""}${pack ? ` — ${pack}` : ""}\n\n` +
          res.skills
            .map((s) => `- **${s.title}** (${s.id}) — ${s.lines} lines\n  ${s.description}`)
            .join("\n") +
          `\n\n---\n${res.pagination.total} total | Showing ${res.skills.length} (offset ${offset || 0})\nCategories: ${res.meta.categories.join(", ")}`;

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: Suggest / Autocomplete ───
server.registerTool(
  "skilldb_suggest",
  {
    title: "Suggest Skills",
    description:
      "Get autocomplete suggestions for skill names. Fast, lightweight — useful for quick lookups.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Partial skill name (min 2 chars)"),
    }),
  },
  async ({ query }) => {
    try {
      const res = await client.suggest(query);
      const text = res.suggestions.length === 0
        ? `No suggestions for "${query}".`
        : res.suggestions
            .map((s) => `- **${s.title}** (${s.pack} / ${s.category})\n  ID: ${s.id}`)
            .join("\n");

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: Recommend Skills for Project ───
server.registerTool(
  "skilldb_recommend",
  {
    title: "Recommend Skills for Project",
    description:
      "Analyze the current project context and recommend relevant SkillDB skill packs. Provide information about the tech stack (languages, frameworks, tools) and get tailored skill pack recommendations.",
    inputSchema: z.object({
      technologies: z.array(z.string()).describe("Technologies in your project (e.g. ['react', 'typescript', 'docker', 'postgresql'])"),
      role: z.string().optional().describe("Your role or focus area (e.g. 'frontend', 'backend', 'devops', 'security')"),
    }),
  },
  async ({ technologies, role }) => {
    // Map technologies to known skill packs
    const TECH_MAP: Record<string, string[]> = {
      react: ["react-patterns-skills", "web-polish-skills"],
      vue: ["vue-skills", "web-polish-skills"],
      angular: ["angular-skills", "web-polish-skills"],
      svelte: ["svelte-skills", "web-polish-skills"],
      next: ["react-patterns-skills", "web-polish-skills"],
      typescript: ["typescript-skills"],
      javascript: ["software-skills", "typescript-skills"],
      python: ["python-skills"],
      rust: ["rust-skills"],
      go: ["go-skills"],
      java: ["java-skills"],
      docker: ["devops-skills", "docker-skills"],
      kubernetes: ["devops-skills", "infrastructure-skills"],
      aws: ["cloud-skills", "infrastructure-skills"],
      gcp: ["cloud-skills"],
      azure: ["cloud-skills"],
      postgresql: ["database-skills", "sql-skills"],
      mongodb: ["database-skills"],
      redis: ["database-skills"],
      graphql: ["api-design-skills"],
      rest: ["api-design-skills"],
      express: ["nodejs-skills", "api-design-skills"],
      fastify: ["nodejs-skills"],
      nestjs: ["nodejs-skills", "api-design-skills"],
      prisma: ["database-skills"],
      "react-native": ["react-native-skills", "mobile-skills"],
      flutter: ["mobile-skills"],
      openai: ["ai-agent-skills", "prompt-engineering-skills"],
      langchain: ["ai-agent-skills", "llm-skills"],
      claude: ["ai-agent-skills", "prompt-engineering-skills"],
    };

    const ROLE_MAP: Record<string, string[]> = {
      frontend: ["css-skills", "web-polish-skills", "typescript-skills"],
      backend: ["software-skills", "api-design-skills", "database-skills"],
      devops: ["devops-skills", "ci-cd-skills", "infrastructure-skills"],
      security: ["security-skills", "appsec-skills", "auth-skills"],
      fullstack: ["software-skills", "react-patterns-skills", "api-design-skills"],
      data: ["data-engineering-skills", "sql-skills", "analytics-skills"],
      mobile: ["mobile-skills", "react-native-skills"],
      ai: ["ai-agent-skills", "prompt-engineering-skills", "llm-skills"],
    };

    const recommended = new Set<string>(["software-skills"]); // always recommend baseline
    for (const tech of technologies) {
      const key = tech.toLowerCase().replace(/[^a-z]/g, "");
      for (const [pattern, packs] of Object.entries(TECH_MAP)) {
        if (key.includes(pattern) || pattern.includes(key)) {
          packs.forEach((p) => recommended.add(p));
        }
      }
    }
    if (role) {
      const rolePacks = ROLE_MAP[role.toLowerCase()] || [];
      rolePacks.forEach((p) => recommended.add(p));
    }

    const packList = [...recommended];
    const text =
      `## Recommended Skill Packs\n\n` +
      `Based on: ${technologies.join(", ")}${role ? ` (${role})` : ""}\n\n` +
      packList.map((p) => `- \`${p}\` — install with \`skilldb add ${p}\``).join("\n") +
      `\n\n**Install all:** \`${packList.map((p) => `skilldb add ${p}`).join(" && ")}\`\n` +
      `\nUse \`skilldb_search\` to explore individual skills within each pack.`;

    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool: Purge Cached Skills ───
server.registerTool(
  "skilldb_purge",
  {
    title: "Purge Cached Skills",
    description:
      "Remove cached SkillDB skills from the local .skilldb/ directory to free disk space. By default removes inactive skills + slim summaries. Use 'all' to clear everything, or 'inactive' to only remove unused skills.",
    inputSchema: z.object({
      mode: z.enum(["default", "all", "inactive", "slim"]).optional().default("default")
        .describe("What to purge: 'default' (inactive + slim), 'all' (everything), 'inactive' (unused only), 'slim' (summaries only)"),
      dryRun: z.boolean().optional().default(false).describe("Preview what would be removed without deleting"),
    }),
  },
  async ({ mode, dryRun }) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const cwd = process.cwd();
      const skilldbDir = path.join(cwd, ".skilldb");
      const skillsDir = path.join(skilldbDir, "skills");
      const activeDir = path.join(skilldbDir, "active");
      const slimDir = path.join(skilldbDir, "slim");

      if (!fs.existsSync(skilldbDir)) {
        return { content: [{ type: "text", text: "No .skilldb/ directory found. Run `skilldb init` first." }] };
      }

      // Collect skills
      const collectSkills = (dir: string): string[] => {
        const skills: string[] = [];
        if (!fs.existsSync(dir)) return skills;
        for (const pack of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!pack.isDirectory()) continue;
          for (const file of fs.readdirSync(path.join(dir, pack.name))) {
            if (file.endsWith(".md")) skills.push(`${pack.name}/${file}`);
          }
        }
        return skills;
      };

      const allSkills = collectSkills(skillsDir);
      const activeSkills = new Set(collectSkills(activeDir));
      const inactiveSkills = allSkills.filter(s => !activeSkills.has(s));
      const slimSkills = collectSkills(slimDir);

      let toPurge: string[] = [];
      let purgeSlim = false;

      if (mode === "all") {
        toPurge = [...allSkills];
        purgeSlim = true;
      } else if (mode === "inactive") {
        toPurge = inactiveSkills;
      } else if (mode === "slim") {
        purgeSlim = true;
      } else {
        toPurge = inactiveSkills;
        purgeSlim = true;
      }

      if (dryRun) {
        const lines = [
          `## Purge Preview (dry run)`,
          `- Skills to remove: ${toPurge.length}`,
          `- Slim summaries to remove: ${purgeSlim ? slimSkills.length : 0}`,
          `- Active skills kept: ${activeSkills.size}`,
          "",
          ...toPurge.slice(0, 30).map(s => `  - ${s}`),
          toPurge.length > 30 ? `  ... and ${toPurge.length - 30} more` : "",
        ];
        return { content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] };
      }

      // Actually purge
      let removed = 0;
      let bytesFreed = 0;
      for (const skillId of toPurge) {
        const [pack, file] = skillId.split("/");
        const filePath = path.join(skillsDir, pack, file);
        if (fs.existsSync(filePath)) {
          bytesFreed += fs.statSync(filePath).size;
          fs.unlinkSync(filePath);
          removed++;
        }
        const packDir = path.join(skillsDir, pack);
        if (fs.existsSync(packDir) && fs.readdirSync(packDir).length === 0) {
          fs.rmdirSync(packDir);
        }
      }

      let slimRemoved = 0;
      if (purgeSlim && fs.existsSync(slimDir)) {
        for (const pack of fs.readdirSync(slimDir, { withFileTypes: true })) {
          if (!pack.isDirectory()) continue;
          const packPath = path.join(slimDir, pack.name);
          for (const file of fs.readdirSync(packPath)) {
            const fp = path.join(packPath, file);
            bytesFreed += fs.statSync(fp).size;
            fs.unlinkSync(fp);
            slimRemoved++;
          }
          if (fs.readdirSync(packPath).length === 0) fs.rmdirSync(packPath);
        }
      }

      if (mode === "all" && fs.existsSync(activeDir)) {
        for (const pack of fs.readdirSync(activeDir, { withFileTypes: true })) {
          if (!pack.isDirectory()) continue;
          const packPath = path.join(activeDir, pack.name);
          for (const file of fs.readdirSync(packPath)) {
            fs.unlinkSync(path.join(packPath, file));
          }
          fs.rmdirSync(packPath);
        }
      }

      const text = [
        `## Purge Complete`,
        `- Skills removed: ${removed}`,
        `- Slim summaries removed: ${slimRemoved}`,
        `- Space freed: ${(bytesFreed / 1024).toFixed(0)} KB`,
        `- Active skills kept: ${mode === "all" ? 0 : activeSkills.size}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: List My Private Skills ───
server.registerTool(
  "skilldb_my_skills",
  {
    title: "List My Private Skills",
    description:
      "List your private skills stored on SkillDB. Requires an API key with 'write' scope. Returns all skills you own plus skills shared with you.",
    inputSchema: z.object({}),
  },
  async () => {
    if (!apiKey) {
      return { content: [{ type: "text", text: "API key required for private skills. Set one with: skilldb-mcp --api-key sk_live_xxx" }], isError: true };
    }
    try {
      const res = await client.rawRequest("/my-skills", { method: "GET" });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `Error: ${data.error || res.statusText}` }], isError: true };

      const own = (data.skills || []);
      const shared = (data.shared || []);

      if (own.length === 0 && shared.length === 0) {
        return { content: [{ type: "text", text: "No private skills yet. Create one with `skilldb_create_skill`." }] };
      }

      let text = `## My Private Skills (${own.length})\n\n`;
      text += own.map((s: Record<string, unknown>, i: number) => `${i + 1}. **${s.title}** (${s.pack})\n   ID: \`${s.id}\` | ${s.lines} lines | ${s.visibility}`).join("\n\n");

      if (shared.length > 0) {
        text += `\n\n## Shared With Me (${shared.length})\n\n`;
        text += shared.map((s: Record<string, unknown>, i: number) => `${i + 1}. **${s.title}** (${s.pack})\n   ID: \`${s.id}\` | ${s.lines} lines | shared by ${s.owner}`).join("\n\n");
      }

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: Create Private Skill ───
server.registerTool(
  "skilldb_create_skill",
  {
    title: "Create Private Skill",
    description:
      "Create a new private skill in your SkillDB account. The skill is only visible to you (and anyone you share it with). Requires an API key with 'write' scope.",
    inputSchema: z.object({
      name: z.string().describe("Skill filename (e.g. 'my-react-patterns')"),
      title: z.string().describe("Human-readable title"),
      content: z.string().describe("Full skill content in markdown"),
      pack: z.string().optional().default("personal").describe("Pack/folder name (default: 'personal')"),
      tags: z.array(z.string()).optional().describe("Tags for searchability"),
      description: z.string().optional().describe("Short description (auto-generated from content if omitted)"),
    }),
  },
  async ({ name, title, content, pack, tags, description }) => {
    if (!apiKey) {
      return { content: [{ type: "text", text: "API key required. Set one with: skilldb-mcp --api-key sk_live_xxx" }], isError: true };
    }
    try {
      const res = await client.rawRequest("/my-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, content, pack, tags, description }),
      });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `Error: ${data.error || res.statusText}` }], isError: true };

      const s = data.skill;
      return { content: [{ type: "text", text: `✅ Private skill created!\n\n**${s.title}**\nID: \`${s.id}\`\nPack: ${s.pack}\nLines: ${s.lines}\nVisibility: ${s.visibility}\n\nYou can now find this skill via \`skilldb_search\` or \`skilldb_my_skills\`.` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool: Update Private Skill ───
server.registerTool(
  "skilldb_update_skill",
  {
    title: "Update Private Skill",
    description:
      "Update an existing private skill's content, title, tags, or visibility. Requires an API key with 'write' scope.",
    inputSchema: z.object({
      id: z.string().describe("Skill ID (e.g. 'personal/my-react-patterns.md')"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content"),
      tags: z.array(z.string()).optional().describe("New tags"),
      visibility: z.enum(["private", "shared"]).optional().describe("Visibility setting"),
    }),
  },
  async ({ id, title, content, tags, visibility }) => {
    if (!apiKey) {
      return { content: [{ type: "text", text: "API key required." }], isError: true };
    }
    try {
      const body: Record<string, unknown> = {};
      if (title) body.title = title;
      if (content) body.content = content;
      if (tags) body.tags = tags;
      if (visibility) body.visibility = visibility;

      const res = await client.rawRequest(`/my-skills/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `Error: ${data.error || res.statusText}` }], isError: true };

      return { content: [{ type: "text", text: `✅ Skill updated: **${data.skill.title}** (${data.skill.lines} lines)` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
    }
  }
);

// ─── Start server ───
const transport = new StdioServerTransport();
await server.connect(transport);
