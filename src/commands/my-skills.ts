import pc from 'picocolors';
import { SkillDBClient } from '../client.js';
import { resolveApiKey } from '../config.js';

/** `skilldb my-skills` — list your private skills (own + shared with you). */
export async function mySkillsCommand(): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.log(pc.red('No API key found.') + ' Run ' + pc.cyan('skilldb login') + ' first.');
    process.exit(1);
  }

  const client = new SkillDBClient({ apiKey });
  try {
    const data = await client.listMySkills();
    const own = data.skills || [];
    const shared = data.shared || [];

    if (!own.length && !shared.length) {
      console.log(pc.dim('No private skills yet.') + ' Create one with ' + pc.cyan('skilldb push <file.md>'));
      return;
    }

    console.log(pc.bold(`Your private skills (${own.length})`));
    for (const s of own) {
      const tagStr = s.tags?.slice(0, 3).join(', ') || '';
      console.log(`  ${pc.cyan(s.id)}  ${pc.dim('·')} ${s.lines} lines${tagStr ? `  ${pc.dim(tagStr)}` : ''}`);
    }

    if (shared.length) {
      console.log('\n' + pc.bold(`Shared with you (${shared.length})`));
      for (const s of shared) {
        console.log(`  ${pc.cyan(s.id)}  ${pc.dim('·')} ${s.lines} lines`);
      }
    }
  } catch (e) {
    console.log(pc.red('Failed to list skills: ') + (e as Error).message);
    process.exit(1);
  }
}
