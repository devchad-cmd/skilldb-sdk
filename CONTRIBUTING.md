# Contributing

Thanks for your interest in improving the SkillDB CLI / SDK / MCP server.

## Setup

```bash
npm install
npm run build      # bundles src/ → dist/ with tsup
npm run dev        # watch mode
```

- Source lives in `src/`. The artifacts in `dist/` are **generated** (git-ignored) — please don't commit them.
- Type-check with `npx tsc --noEmit`.

## Pull requests

- Keep changes focused and match the existing code style.
- Make sure `npm run build` and `npx tsc --noEmit` pass — CI runs both on every PR (Node 18/20/22).
- This package is published to npm via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers); maintainers cut releases by bumping `package.json` and tagging `sdk-v*`.

## Project layout

| Path | What |
|------|------|
| `src/cli.ts` | the `skilldb` CLI (commander) |
| `src/mcp.ts` | the `skilldb-mcp` Model Context Protocol server |
| `src/client.ts` | HTTP client for the public SkillDB API |
| `src/commands/` | individual CLI commands |
| `src/config.ts` | API-key resolution (`SKILLDB_API_KEY`, `.skilldbrc`) |
