import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { readManifest } from '../cache.js';

const SKILLDB_DIR = '.skilldb';
const ACTIVE_DIR = 'active';
const CONFIG_FILE = 'config.json';

const PROFILES: Record<string, string[]> = {
  frontend: ['react-patterns-skills', 'web-polish-skills', 'typescript-skills', 'css-skills'],
  backend: ['software-skills', 'api-design-skills', 'database-skills', 'nodejs-skills'],
  devops: ['devops-skills', 'docker-skills', 'ci-cd-skills', 'infrastructure-skills'],
  security: ['security-skills', 'appsec-skills', 'auth-skills'],
  data: ['data-engineering-skills', 'sql-skills', 'analytics-skills'],
  fullstack: ['react-patterns-skills', 'software-skills', 'typescript-skills', 'api-design-skills'],
  mobile: ['react-native-skills', 'mobile-skills', 'ios-skills', 'android-skills'],
  'ai-agent': ['ai-agent-skills', 'prompt-engineering-skills', 'llm-skills'],
};

interface Config {
  activeProfile?: string;
  budget?: { max: number; unit: string };
  [key: string]: unknown;
}

function readConfig(cwd: string): Config {
  const p = path.join(cwd, SKILLDB_DIR, CONFIG_FILE);
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}

function writeConfig(cwd: string, config: Config): void {
  const dir = path.join(cwd, SKILLDB_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}

function autoDetect(cwd: string): string {
  const has = (f: string) => fs.existsSync(path.join(cwd, f));
  let pkgDeps: string[] = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    pkgDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch { /* no package.json */ }

  if (pkgDeps.some(d => ['react-native', 'expo'].includes(d))) return 'mobile';
  if (pkgDeps.some(d => ['react', 'next', 'vue', 'svelte', 'angular'].includes(d))) {
    if (pkgDeps.some(d => ['express', 'fastify', 'nestjs', 'prisma'].includes(d))) return 'fullstack';
    return 'frontend';
  }
  if (has('Dockerfile') || has('docker-compose.yml') || has('.github/workflows')) return 'devops';
  if (pkgDeps.some(d => ['langchain', 'openai', '@anthropic-ai/sdk'].includes(d))) return 'ai-agent';
  if (pkgDeps.some(d => ['express', 'fastify', 'koa', 'nestjs'].includes(d))) return 'backend';
  return 'fullstack';
}

function activateProfile(cwd: string, profile: string): void {
  const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
  if (fs.existsSync(activeDir)) fs.rmSync(activeDir, { recursive: true });
  fs.mkdirSync(activeDir, { recursive: true });

  const packs = PROFILES[profile] || [];
  const skillsDir = path.join(cwd, SKILLDB_DIR, 'skills');
  let copied = 0;

  for (const pack of packs) {
    const packDir = path.join(skillsDir, pack);
    if (!fs.existsSync(packDir)) continue;
    const destDir = path.join(activeDir, pack);
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(packDir)) {
      fs.copyFileSync(path.join(packDir, file), path.join(destDir, file));
      copied++;
    }
  }

  const config = readConfig(cwd);
  config.activeProfile = profile;
  writeConfig(cwd, config);

  console.log(pc.green(`Profile "${profile}" activated`) + pc.dim(` (${copied} skills in .skilldb/active/)`));
  if (copied === 0) {
    console.log(pc.yellow('No matching skills found locally. Install packs first:'));
    for (const pack of packs.slice(0, 3)) {
      console.log(pc.dim(`  skilldb add ${pack}`));
    }
  }
}

export async function useCommand(profile: string, options: { list?: boolean; current?: boolean }): Promise<void> {
  const cwd = process.cwd();

  if (options.list) {
    console.log(pc.bold('Available profiles:\n'));
    for (const [name, packs] of Object.entries(PROFILES)) {
      console.log(`  ${pc.cyan(name.padEnd(12))} ${pc.dim(packs.join(', '))}`);
    }
    console.log(pc.dim('\nUse "skilldb use auto" to auto-detect from project files.'));
    return;
  }

  if (options.current) {
    const config = readConfig(cwd);
    if (config.activeProfile) {
      console.log(`Active profile: ${pc.cyan(config.activeProfile)}`);
    } else {
      console.log(pc.dim('No active profile. Run "skilldb use <profile>" to activate.'));
    }
    return;
  }

  if (profile === 'none') {
    const activeDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
    if (fs.existsSync(activeDir)) fs.rmSync(activeDir, { recursive: true });
    const config = readConfig(cwd);
    delete config.activeProfile;
    writeConfig(cwd, config);
    console.log(pc.green('Profile deactivated. Active directory cleared.'));
    return;
  }

  if (profile === 'auto') {
    const detected = autoDetect(cwd);
    console.log(pc.dim(`Auto-detected profile: ${detected}`));
    activateProfile(cwd, detected);
    return;
  }

  if (!PROFILES[profile]) {
    console.error(pc.red(`Unknown profile "${profile}". Use --list to see available profiles.`));
    process.exit(1);
  }

  activateProfile(cwd, profile);
}
