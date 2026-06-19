import pc from 'picocolors';
import { SkillDBClient } from '../client.js';

export async function listCommand(options: { category?: string; pack?: string; limit?: string }): Promise<void> {
  const client = new SkillDBClient();
  const limit = options.limit ? parseInt(options.limit) : 50;

  try {
    const res = await client.list({ category: options.category, pack: options.pack, limit });

    if (res.skills.length === 0) {
      console.log(pc.yellow('No skills found.'));
      return;
    }

    // If no filter, show categories overview
    if (!options.category && !options.pack) {
      console.log(pc.bold('Categories:'));
      for (const cat of res.meta.categories) {
        console.log(`  ${pc.cyan(cat)}`);
      }
      console.log(`\n${pc.dim(`${res.meta.totalPacks} packs, ${res.pagination.total} skills total`)}`);
      console.log(pc.dim('Use --category or --pack to filter.\n'));
    }

    // Print skills
    const nameW = 30;
    const packW = 24;
    const catW = 20;

    console.log(pc.dim(pad('SKILL', nameW) + pad('PACK', packW) + 'CATEGORY'));
    console.log(pc.dim('─'.repeat(nameW + packW + catW)));

    for (const s of res.skills) {
      console.log(
        pc.cyan(pad(truncate(s.title, nameW - 2), nameW)) +
        pc.white(pad(truncate(s.packLabel, packW - 2), packW)) +
        pc.dim(s.category)
      );
    }

    if (res.pagination.hasMore) {
      console.log(pc.dim(`\nShowing ${res.skills.length} of ${res.pagination.total}. Use --limit to see more.`));
    }
  } catch (err) {
    console.error(pc.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

function pad(str: string, width: number): string {
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}
