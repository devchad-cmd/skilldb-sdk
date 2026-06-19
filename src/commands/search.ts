import pc from 'picocolors';
import { SkillDBClient } from '../client.js';

export async function searchCommand(query: string, options: { category?: string; limit?: string }): Promise<void> {
  const client = new SkillDBClient();
  const limit = options.limit ? parseInt(options.limit) : 20;

  try {
    const res = await client.search(query, { category: options.category, limit });

    if (res.skills.length === 0) {
      console.log(pc.yellow(`No skills found for "${query}"`));
      return;
    }

    console.log(pc.bold(`Found ${res.pagination.total} skill${res.pagination.total === 1 ? '' : 's'} for "${query}":\n`));

    // Column widths
    const idW = 42;
    const nameW = 28;
    const descW = 44;

    console.log(
      pc.dim(
        pad('ID', idW) + pad('SKILL', nameW) + 'DESCRIPTION'
      )
    );
    console.log(pc.dim('─'.repeat(idW + nameW + descW)));

    for (const s of res.skills) {
      const id = truncate(s.id.replace('.md', ''), idW - 2);
      const name = truncate(s.title, nameW - 2);
      const desc = truncate(s.description, descW);
      console.log(
        pc.white(pad(id, idW)) + pc.cyan(pad(name, nameW)) + pc.dim(desc)
      );
    }

    if (res.pagination.hasMore) {
      console.log(pc.dim(`\n... and ${res.pagination.total - res.skills.length} more. Use --limit to see more.`));
    }

    console.log(pc.dim(`\nTo download a skill: `) + pc.cyan(`skilldb get <pack>/<skill-name>`));
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
