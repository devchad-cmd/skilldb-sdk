# Security Policy

This package is a CLI and MCP server that handle your SkillDB **API key** locally and talk to the SkillDB API, so we take security seriously.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.

We'll acknowledge the report and work with you on a fix and coordinated disclosure.

## Supported versions

The latest published [`skilldb`](https://www.npmjs.com/package/skilldb) release on npm is supported. Please upgrade to the newest version before reporting an issue.

## Good to know

- The CLI/SDK never transmits your API key anywhere except the SkillDB API over HTTPS. Keys are read from `SKILLDB_API_KEY` or `~/.skilldbrc` / project `.skilldbrc` and are never logged.
- Builds are published to npm via OIDC Trusted Publishing with provenance, so each release is verifiably built from this repository.
