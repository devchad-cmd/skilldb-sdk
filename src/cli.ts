import { Command } from 'commander';
import { searchCommand } from './commands/search.js';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { getCommand } from './commands/get.js';
import { infoCommand } from './commands/info.js';
import { initCommand } from './commands/init.js';
import { loginCommand } from './commands/login.js';
import { useCommand } from './commands/use.js';
import { budgetCommand } from './commands/budget.js';
import { slimCommand } from './commands/slim.js';
import { recommendCommand } from './commands/recommend.js';
import { doctorCommand } from './commands/doctor.js';
import { updateCommand } from './commands/update.js';
import { removeCommand } from './commands/remove.js';
import { exportCommand } from './commands/export.js';
import { statsCommand } from './commands/stats.js';
import { diffCommand } from './commands/diff.js';
import { purgeCommand } from './commands/purge.js';
import { pushCommand } from './commands/push.js';
import { mySkillsCommand } from './commands/my-skills.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read the version from package.json at runtime so `skilldb --version` never
// drifts from the published version (it used to be hardcoded).
function pkgVersion(): string {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')).version || '0.0.0';
  } catch {
    return '0.8.0';
  }
}

const program = new Command();

program
  .name('skilldb')
  .description('SkillDB CLI — discover, install, and manage AI agent skills')
  .version(pkgVersion());

program
  .command('init')
  .description('Initialize SkillDB in this project (detect IDE, choose install mode)')
  .option('-t, --target <mode>', 'Install mode: mcp, skills-dir, claude-md, hybrid')
  .action((opts: { target?: string }) => initCommand(opts));

program
  .command('login')
  .description('Save your SkillDB API key')
  .action(loginCommand);

program
  .command('push <file>')
  .description('Create (or update) a private skill from a local Markdown file (Studio plan)')
  .option('-p, --pack <name>', 'Pack/folder name', 'personal')
  .option('-n, --name <name>', 'Skill name/filename (default: derived from the file)')
  .option('-t, --title <title>', 'Title (default: first Markdown H1, else filename)')
  .option('-d, --description <text>', 'Short description')
  .option('--tags <list>', 'Comma-separated tags')
  .option('-u, --update', 'Update an existing skill with the same name/pack')
  .action((file: string, opts: { pack?: string; name?: string; title?: string; description?: string; tags?: string; update?: boolean }) =>
    pushCommand(file, opts));

program
  .command('my-skills')
  .description('List your private skills (own + shared with you)')
  .action(mySkillsCommand);

program
  .command('search <query...>')
  .description('Search skills by keyword(s)')
  .option('-c, --category <name>', 'Filter by category')
  .option('-l, --limit <n>', 'Max results', '20')
  .action((queryParts: string[], options: { category?: string; limit?: string }) => {
    searchCommand(queryParts.join(' '), options);
  });

program
  .command('list')
  .description('List skills, optionally filtered')
  .option('-c, --category <name>', 'Filter by category')
  .option('-p, --pack <name>', 'Filter by pack')
  .option('-l, --limit <n>', 'Max results', '50')
  .action(listCommand);

program
  .command('get <id>')
  .description('Download a single skill to .skilldb/skills/ (e.g. "software-skills/code-review")')
  .action(getCommand);

program
  .command('add <pack>')
  .description('Download skills (use --target to choose where)')
  .option('-t, --target <mode>', 'Where to install: cache (default), skills-dir, hybrid')
  .action((pack: string, opts: { target?: string }) => addCommand(pack, opts));

program
  .command('info <id>')
  .description('Show metadata and preview for a skill (e.g. "software-skills/code-review")')
  .action(infoCommand);

program
  .command('use [profile]')
  .description('Activate a skill profile (frontend, backend, devops, security, data, fullstack, mobile, ai-agent, auto, none)')
  .option('--list', 'List available profiles')
  .option('--current', 'Show active profile')
  .action((profile: string | undefined, options: { list?: boolean; current?: boolean }) => {
    if (!profile && !options.list && !options.current) {
      options.list = true;
    }
    useCommand(profile || '', options);
  });

program
  .command('budget [action] [value]')
  .description('Manage token/line budget for active skills')
  .action((action?: string, value?: string) => {
    budgetCommand(action, value);
  });

program
  .command('slim [pack]')
  .description('Generate compressed skill summaries')
  .option('-r, --ratio <ratio>', 'Keep ratio (0-1, default 0.3)', '0.3')
  .action((pack: string | undefined, options: { ratio?: string }) => {
    slimCommand(pack, options);
  });

program
  .command('recommend')
  .description('Scan project and suggest skill packs')
  .option('-i, --install', 'Auto-install recommendations')
  .action(recommendCommand);

program
  .command('doctor')
  .description('Run health check and audit on installed skills')
  .action(doctorCommand);

program
  .command('update [pack]')
  .alias('sync')
  .description('Update installed skills from remote (alias: sync)')
  .action((pack?: string) => {
    updateCommand(pack);
  });

program
  .command('remove <target>')
  .description('Remove a skill or pack (e.g. "software-skills/code-review" or "software-skills")')
  .option('--unused', 'Remove skills not in active profile')
  .action((target: string, options: { unused?: boolean }) => {
    removeCommand(target, options);
  });

program
  .command('export <format> [target]')
  .description('Export skills (formats: claude, cursor, profile, inject)')
  .action((format: string, target?: string) => {
    exportCommand(format, target);
  });

program
  .command('stats')
  .description('Show local statistics and coverage')
  .action(statsCommand);

program
  .command('diff [target]')
  .description('Compare local skills with latest remote versions')
  .action((target?: string) => {
    diffCommand(target);
  });

program
  .command('purge')
  .description('Remove cached skills to free disk space')
  .option('-a, --all', 'Remove ALL cached skills (including active)')
  .option('-i, --inactive', 'Remove only inactive skills')
  .option('-s, --slim', 'Also remove slim summaries')
  .option('-n, --dry-run', 'Show what would be removed without deleting')
  .option('-f, --force', 'Skip confirmation prompt')
  .action((opts: { all?: boolean; inactive?: boolean; slim?: boolean; dryRun?: boolean; force?: boolean }) => {
    purgeCommand(opts);
  });

program.parse();
