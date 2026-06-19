import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import readline from 'node:readline';
import { initCache, updateGitignore } from '../cache.js';

type IDE = 'claude-code' | 'cursor' | 'codex';
type InstallMode = 'mcp' | 'skills-dir' | 'claude-md' | 'hybrid';

interface Detection {
  ide: IDE;
  label: string;
  skillsDir: string;  // IDE-native skills directory
  configFile: string; // CLAUDE.md / .cursorrules / codex.md
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function detectIDE(cwd: string): Detection | null {
  if (fs.existsSync(path.join(cwd, 'CLAUDE.md')) || fs.existsSync(path.join(cwd, '.claude'))) {
    return {
      ide: 'claude-code', label: 'Claude Code',
      skillsDir: path.join(cwd, '.claude', 'skills', 'skilldb'),
      configFile: path.join(cwd, 'CLAUDE.md'),
    };
  }
  if (fs.existsSync(path.join(cwd, '.cursor')) || fs.existsSync(path.join(cwd, '.cursorrules'))) {
    return {
      ide: 'cursor', label: 'Cursor',
      skillsDir: path.join(cwd, '.cursor', 'rules', 'skilldb'),
      configFile: fs.existsSync(path.join(cwd, '.cursorrules'))
        ? path.join(cwd, '.cursorrules')
        : path.join(cwd, '.cursor', 'rules', 'skilldb.md'),
    };
  }
  if (fs.existsSync(path.join(cwd, 'codex.md')) || fs.existsSync(path.join(cwd, '.codex'))) {
    return {
      ide: 'codex', label: 'Codex CLI',
      skillsDir: path.join(cwd, '.codex', 'skills', 'skilldb'),
      configFile: path.join(cwd, 'codex.md'),
    };
  }
  return null;
}

const IDE_SKILLS_DIRS: Record<IDE, string> = {
  'claude-code': '.claude/skills/skilldb',
  'cursor': '.cursor/rules/skilldb',
  'codex': '.codex/skills/skilldb',
};

export async function initCommand(options?: { target?: string }): Promise<void> {
  const cwd = process.cwd();
  console.log(pc.bold('SkillDB Init\n'));

  // Detect IDE
  let detection = detectIDE(cwd);

  if (detection) {
    console.log(`Detected: ${pc.cyan(detection.label)}`);
  } else {
    console.log('No IDE config detected. Which are you using?');
    console.log('  1) Claude Code');
    console.log('  2) Cursor');
    console.log('  3) Codex CLI');
    const choice = await prompt('\nChoice (1-3): ');

    const ideMap: Record<string, IDE> = { '1': 'claude-code', '2': 'cursor', '3': 'codex' };
    const ide = ideMap[choice];
    if (!ide) { console.log(pc.red('Invalid choice.')); process.exit(1); }

    detection = {
      ide, label: ide === 'claude-code' ? 'Claude Code' : ide === 'cursor' ? 'Cursor' : 'Codex CLI',
      skillsDir: path.join(cwd, IDE_SKILLS_DIRS[ide]),
      configFile: path.join(cwd, ide === 'claude-code' ? 'CLAUDE.md' : ide === 'cursor' ? '.cursorrules' : 'codex.md'),
    };
  }

  // Choose install mode
  const targetArg = options?.target;
  let mode: InstallMode;

  if (targetArg === 'mcp') mode = 'mcp';
  else if (targetArg === 'skills-dir') mode = 'skills-dir';
  else if (targetArg === 'claude-md' || targetArg === 'config') mode = 'claude-md';
  else {
    console.log(`\nWhere should skills be loaded from?\n`);
    console.log(`  1) ${pc.cyan('MCP Server')}         ${pc.dim('— agent fetches on demand, nothing added to files (recommended)')}`);
    console.log(`  2) ${pc.cyan('Skills directory')}    ${pc.dim(`— installed to ${IDE_SKILLS_DIRS[detection.ide]}, auto-loaded by IDE`)}`);
    console.log(`  3) ${pc.cyan('Hybrid')}              ${pc.dim('— MCP for search + skills dir for always-on core skills')}`);
    console.log(`  4) ${pc.cyan(path.basename(detection.configFile))}       ${pc.dim('— append to config file (legacy, can bloat)')}`);
    const modeChoice = await prompt('\nChoice (1-4): ');
    mode = { '1': 'mcp' as const, '2': 'skills-dir' as const, '3': 'hybrid' as const, '4': 'claude-md' as const }[modeChoice] || 'hybrid';
  }

  // Create .skilldb/ cache directory
  const cacheDir = initCache(cwd);
  console.log(`\nCreated ${pc.dim(cacheDir)}`);

  // Update .gitignore
  updateGitignore(cwd);

  // ─── Mode: MCP ───
  if (mode === 'mcp' || mode === 'hybrid') {
    console.log(`\n${pc.cyan('MCP Server setup:')}`);
    console.log(`  Install globally:  ${pc.dim('npm install -g skilldb')}`);

    if (detection.ide === 'claude-code') {
      console.log(`  Add to Claude:     ${pc.dim('claude mcp add skilldb -- skilldb-mcp')}`);
    } else if (detection.ide === 'cursor') {
      console.log(`  Add to Cursor:     ${pc.dim('Add to .cursor/mcp.json:')}`);
      console.log(pc.dim(`    { "mcpServers": { "skilldb": { "command": "skilldb-mcp" } } }`));
    } else {
      console.log(`  Run:               ${pc.dim('skilldb-mcp')}`);
    }

    // Add minimal reference to config file
    const marker = '<!-- skilldb:start -->';
    const snippet = `\n\n${marker}\n## SkillDB\nSkills available via MCP server. Use \`skilldb_search\` to find skills and \`skilldb_get\` to load them.\n<!-- skilldb:end -->\n`;
    const configFile = detection.configFile;
    let existing = '';
    if (fs.existsSync(configFile)) existing = fs.readFileSync(configFile, 'utf-8');
    if (!existing.includes('skilldb:start')) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, existing + snippet);
      console.log(`\n  Added MCP reference to ${pc.cyan(path.basename(configFile))} ${pc.dim('(2 lines, no bloat)')}`);
    }
  }

  // ─── Mode: Skills Directory ───
  if (mode === 'skills-dir' || mode === 'hybrid') {
    const skillsDir = detection.skillsDir;
    fs.mkdirSync(skillsDir, { recursive: true });
    console.log(`\n${pc.cyan('Skills directory:')} ${pc.dim(skillsDir)}`);
    console.log(`  Skills installed here are auto-loaded by ${detection.label}.`);
    console.log(`  Add skills:  ${pc.dim('skilldb add software-skills --target skills-dir')}`);

    // Write a README to the skills dir
    fs.writeFileSync(path.join(skillsDir, 'README.md'), `# SkillDB Skills\n\nSkills in this directory are automatically loaded by ${detection.label}.\n\nManage with:\n- \`skilldb add <pack> --target skills-dir\`\n- \`skilldb remove <pack>\`\n- \`skilldb use <profile>\`\n\nBrowse: https://skilldb.dev\n`);
  }

  // ─── Mode: Config File (legacy) ───
  if (mode === 'claude-md') {
    const marker = '<!-- skilldb:start -->';
    const endMarker = '<!-- skilldb:end -->';
    const content = `\n## SkillDB Skills\n\nLocal skills: \`.skilldb/skills/\`. Use as reference for tasks.\nSearch: \`skilldb search <query>\`\nDownload: \`skilldb add <pack>\`\n`;
    const snippet = `\n\n${marker}${content}${endMarker}\n`;
    const configFile = detection.configFile;
    let existing = '';
    if (fs.existsSync(configFile)) existing = fs.readFileSync(configFile, 'utf-8');
    if (!existing.includes('skilldb:start')) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, existing + snippet);
      console.log(`\nAdded SkillDB snippet to ${pc.cyan(path.basename(configFile))}`);
    }
    console.log(pc.yellow('\n⚠  Config-file mode can bloat over time. Consider --target mcp or --target skills-dir.'));
  }

  // Save mode preference
  const configPath = path.join(cwd, '.skilldb', 'config.json');
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch {}
  config.installMode = mode;
  config.ide = detection.ide;
  config.skillsDir = detection.skillsDir;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(pc.green('\n✓ Done! Next steps:'));
  if (mode === 'mcp' || mode === 'hybrid') {
    console.log(`  ${pc.dim('$')} npm install -g skilldb`);
    if (detection.ide === 'claude-code') {
      console.log(`  ${pc.dim('$')} claude mcp add skilldb -- skilldb-mcp`);
    }
    console.log(`  Then ask your agent: ${pc.dim('"Search SkillDB for code review skills"')}`);
  }
  if (mode === 'skills-dir' || mode === 'hybrid') {
    console.log(`  ${pc.dim('$')} skilldb add software-skills --target skills-dir`);
  }
  if (mode === 'claude-md') {
    console.log(`  ${pc.dim('$')} skilldb add software-skills`);
  }
}
