import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = process.cwd();
const OUTPUT_PREFIX = 'combine-part';
const MAX_CHARS = 175_000;

const INCLUDE_EXTENSIONS = new Set([
  '.ts',
  // '.mjs',
  '.json',
  // '.md',
  // '.yml',
  // '.yaml',
  // '.lua', //
]);

const INCLUDE_FILENAMES = new Set([
  // "Dockerfile",
  // "Makefile",
  // '.npmrc',
  // '.gitkeep',
  // '.prettierrc',
  // '.npmignore',
  // '.gitignore',
  // '.editorconfig',
  // ".dockerignore",
  // ".code-workspace",
  // ".example",
  // 'build',
]);

const IGNORE_NAMES = new Set([
  '.git',
  '.turbo',
  '.vscode',
  'node_modules',
  'pnpm-lock.yaml',
  'package-lock.json',
  'dist',
  'build',
  'README.md', //

  'tsup.config.ts',
  'vitest.config.ts',
]);

const IGNORE_PATH_PREFIXES = [
  'test', //

  'scripts',
];

function normalize(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

function shouldIgnore(relPath: string): boolean {
  const normalized = normalize(relPath);

  // 1. scoped ignore
  for (const prefix of IGNORE_PATH_PREFIXES) {
    if (
      normalized === prefix.replace(/\/$/, '') ||
      normalized.startsWith(prefix)
    ) {
      return true;
    }
  }

  // 2. generic ignore by segment
  const parts = normalized.split('/');
  return parts.some((p) => IGNORE_NAMES.has(p));
}

function shouldInclude(fileName: string): boolean {
  return (
    INCLUDE_EXTENSIONS.has(path.extname(fileName)) ||
    INCLUDE_FILENAMES.has(fileName as never)
  );
}

function isProbablyText(content: string): boolean {
  // crude binary detection
  return !content.includes('\0');
}

// ---- File Walker (Iterative DFS) ----

async function collectFiles(): Promise<string[]> {
  const stack: string[] = [ROOT_DIR];
  const result: string[] = [];

  while (stack.length) {
    const dir = stack.pop()!;

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(ROOT_DIR, fullPath);

      if (!rel) continue;
      if (shouldIgnore(rel)) continue;

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        if (shouldInclude(entry.name)) {
          result.push(fullPath);
        }
      }
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

// ---- Main Processor ----

async function run() {
  const files = await collectFiles();

  let part = 1;
  let currentChars = 0;
  let buffer = '';

  async function flush() {
    if (!buffer.trim()) return;

    const fileName = `${OUTPUT_PREFIX}-${part}.md`;

    await fs.writeFile(fileName, buffer.trimEnd() + '\n', 'utf8');

    console.log(`✔ written ${fileName}`);

    buffer = '';
    currentChars = 0;
    part++;
  }

  for (const file of files) {
    const rel = normalize(path.relative(ROOT_DIR, file));

    if (rel.startsWith(OUTPUT_PREFIX)) continue;

    let content: string;
    try {
      content = (await fs.readFile(file, 'utf8')).trimEnd();
    } catch {
      continue;
    }

    if (!isProbablyText(content)) {
      continue;
    }

    const section = `## ${rel}\n\n${content}\n\n---\n\n`;
    const size = section.length;

    if (size > MAX_CHARS) {
      console.warn(`⚠ skipped ${rel} (${size} > ${MAX_CHARS})`);
      continue;
    }

    if (currentChars + size > MAX_CHARS) {
      await flush();
    }

    buffer += section;
    currentChars += size;
  }

  await flush();

  console.log(`✔ done. Total parts: ${part - 1}`);
}

// ---- Entry ----

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
