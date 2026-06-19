import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

const SKILLDB_DIR = '.skilldb';
const ACTIVE_DIR = 'active';
const SLIM_DIR = 'slim';
const SKILLS_DIR = 'skills';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slimContent(content: string, ratio: number): string {
  const lines = content.split('\n');
  const kept: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines = 0;
  let skipExplanation = false;

  for (const line of lines) {
    // Always keep titles and headers
    if (line.startsWith('#')) {
      kept.push(line);
      skipExplanation = false;
      continue;
    }

    // Track code blocks — keep short ones, trim long ones
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = 0;
        kept.push(line);
      } else {
        inCodeBlock = false;
        kept.push(line);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines++;
      if (codeBlockLines <= 15) kept.push(line);
      else if (codeBlockLines === 16) kept.push('  // ... (trimmed)');
      continue;
    }

    // Keep checklist items and bullet points
    if (line.match(/^[-*]\s+\[[ x]\]/)) { kept.push(line); continue; }
    if (line.match(/^[-*]\s+\*\*/)) { kept.push(line); continue; }
    if (line.match(/^\d+\.\s+\*\*/)) { kept.push(line); continue; }

    // Keep short bullet points (methodology steps)
    if (line.match(/^[-*]\s+/) && line.length < 120) { kept.push(line); continue; }
    if (line.match(/^\d+\.\s+/) && line.length < 120) { kept.push(line); continue; }

    // Keep bold/key lines
    if (line.match(/^\*\*.+\*\*/)) { kept.push(line); continue; }

    // Skip verbose explanation paragraphs
    if (line.trim() === '') {
      if (!skipExplanation) kept.push(line);
      continue;
    }

    // Keep if within ratio budget
    if (kept.length / Math.max(lines.length, 1) < ratio) {
      kept.push(line);
    } else {
      skipExplanation = true;
    }
  }

  return kept.join('\n');
}

function processDir(sourceDir: string, destDir: string, ratio: number): number {
  ensureDir(destDir);
  let count = 0;

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const srcPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      count += processDir(srcPath, path.join(destDir, entry.name), ratio);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;

    const content = fs.readFileSync(srcPath, 'utf-8');
    const slimmed = slimContent(content, ratio);
    const footer = `\n\n---\n*Full skill: \`skilldb get ${entry.name.replace('.md', '')}\`*\n`;

    ensureDir(destDir);
    fs.writeFileSync(path.join(destDir, entry.name), slimmed + footer);
    count++;

    const origLines = content.split('\n').length;
    const slimLines = slimmed.split('\n').length;
    console.log(
      pc.green(`  slim  ${entry.name}`) +
      pc.dim(` ${origLines} → ${slimLines} lines (${Math.round((slimLines / origLines) * 100)}%)`)
    );
  }

  return count;
}

export async function slimCommand(pack?: string, options?: { ratio?: string }): Promise<void> {
  const cwd = process.cwd();
  const ratio = options?.ratio ? parseFloat(options.ratio) : 0.3;

  if (ratio <= 0 || ratio >= 1) {
    console.error(pc.red('Ratio must be between 0 and 1 (e.g. 0.3 for 30%).'));
    process.exit(1);
  }

  const slimDir = path.join(cwd, SKILLDB_DIR, SLIM_DIR);
  console.log(pc.bold(`Generating slim versions (${Math.round(ratio * 100)}% ratio)\n`));

  let sourceDir: string;
  if (pack) {
    sourceDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR, pack);
    if (!fs.existsSync(sourceDir)) {
      sourceDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR, pack);
    }
    if (!fs.existsSync(sourceDir)) {
      console.error(pc.red(`Pack "${pack}" not found in skills/ or active/.`));
      process.exit(1);
    }
  } else {
    sourceDir = path.join(cwd, SKILLDB_DIR, ACTIVE_DIR);
    if (!fs.existsSync(sourceDir)) {
      sourceDir = path.join(cwd, SKILLDB_DIR, SKILLS_DIR);
    }
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(pc.red('No skills found. Install skills first with "skilldb add <pack>".'));
    process.exit(1);
  }

  const destDir = pack ? path.join(slimDir, pack) : slimDir;
  const count = processDir(sourceDir, destDir, ratio);
  console.log(pc.green(`\n${count} skill(s) slimmed → .skilldb/slim/`));
}
