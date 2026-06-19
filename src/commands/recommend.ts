import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { readManifest, initCache, cacheSkill } from '../cache.js';

const TECH_MAP: Record<string, string[]> = {
  react: ['react-patterns-skills', 'web-polish-skills'],
  next: ['react-patterns-skills', 'web-polish-skills', 'nextjs-skills'],
  vue: ['vue-skills', 'web-polish-skills'],
  angular: ['angular-skills', 'web-polish-skills'],
  express: ['software-skills', 'api-design-skills', 'nodejs-skills'],
  fastify: ['software-skills', 'api-design-skills', 'nodejs-skills'],
  nestjs: ['software-skills', 'api-design-skills', 'nodejs-skills'],
  prisma: ['database-skills', 'software-skills'],
  typescript: ['typescript-skills', 'software-skills'],
  tailwindcss: ['css-skills', 'web-polish-skills'],
  docker: ['devops-skills', 'docker-skills'],
  openai: ['ai-agent-skills', 'prompt-engineering-skills'],
  '@anthropic-ai/sdk': ['ai-agent-skills', 'prompt-engineering-skills'],
  langchain: ['ai-agent-skills', 'llm-skills'],
  'react-native': ['mobile-skills', 'react-native-skills'],
  expo: ['mobile-skills', 'react-native-skills'],
  jest: ['testing-skills', 'software-skills'],
  vitest: ['testing-skills', 'software-skills'],
};

function scanProject(cwd: string): { detected: string[]; packs: Set<string> } {
  const detected: string[] = [];
  const packs = new Set<string>();

  // Scan package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      const key = dep.replace(/^@[^/]+\//, '');
      if (TECH_MAP[dep]) {
        detected.push(dep);
        TECH_MAP[dep].forEach(p => packs.add(p));
      } else if (TECH_MAP[key]) {
        detected.push(key);
        TECH_MAP[key].forEach(p => packs.add(p));
      }
    }
  } catch { /* no package.json */ }

  // Check common files
  if (fs.existsSync(path.join(cwd, 'Dockerfile'))) {
    detected.push('docker');
    (TECH_MAP.docker || []).forEach(p => packs.add(p));
  }
  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    detected.push('typescript');
    (TECH_MAP.typescript || []).forEach(p => packs.add(p));
  }

  // Always recommend software-skills as baseline
  packs.add('software-skills');

  return { detected, packs };
}

export async function recommendCommand(options: { install?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const manifest = readManifest(cwd);
  const installed = new Set(Object.keys(manifest.installed).map(id => id.split('/')[0]));

  console.log(pc.bold('Scanning project...\n'));
  const { detected, packs } = scanProject(cwd);

  if (detected.length > 0) {
    console.log(pc.dim('Detected technologies: ') + detected.join(', '));
    console.log();
  }

  const missing = [...packs].filter(p => !installed.has(p));
  const existing = [...packs].filter(p => installed.has(p));

  if (existing.length > 0) {
    console.log(pc.green('Already installed:'));
    for (const p of existing) {
      console.log(pc.dim(`  + ${p}`));
    }
    console.log();
  }

  if (missing.length === 0) {
    console.log(pc.green('You have all recommended packs installed!'));
    return;
  }

  console.log(pc.yellow('Recommended packs to install:'));
  for (const p of missing) {
    console.log(`  ${pc.cyan(p)}`);
  }

  if (!options.install) {
    console.log(pc.dim('\nRun "skilldb recommend --install" to auto-install all.'));
    return;
  }

  // Auto-install
  console.log(pc.bold('\nInstalling recommended packs...\n'));
  const client = new SkillDBClient();
  initCache(cwd);

  for (const pack of missing) {
    try {
      const res = await client.list({ pack, limit: 500, includeContent: true });
      if (res.skills.length === 0) {
        console.log(pc.dim(`  skip  ${pack} (not found)`));
        continue;
      }
      let added = 0;
      for (const skill of res.skills) {
        cacheSkill(skill, cwd);
        added++;
      }
      console.log(pc.green(`  add   ${pack}`) + pc.dim(` (${added} skills)`));
    } catch (err) {
      console.log(pc.red(`  fail  ${pack}: ${(err as Error).message}`));
    }
  }

  console.log(pc.green('\nDone! Run "skilldb use auto" to activate a profile.'));
}
