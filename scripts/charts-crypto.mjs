import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const chartPaths = [
  'public/gto-preflop-charts-all.json', 'public/gto-cache-preflop-chart.json',
  'public/bencb-preflop-charts.json', 'public/tournament-flop-cbet.json',
  'scripts/data/flop-board-textures.json',
];

function validateJson(path) {
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    // JSON parse errors can include plaintext; do not echo their contents.
    throw new Error(`Invalid or unreadable JSON: ${basename(path)}`);
  }
}

function run(mode) {
  if (!['encrypt', 'decrypt'].includes(mode)) throw new Error('Usage: node scripts/charts-crypto.mjs <encrypt|decrypt>');
  if (!process.env.DATA_KEY) throw new Error('DATA_KEY is required');

  const directory = resolve('public');
  // On the destination filesystem so each final rename is atomic.
  // mkdtemp creates a private (0700) directory for temporary plaintext.
  const staging = mkdtempSync(join(directory, '.charts-crypto-'));
  try {
    const replacements = [];
    for (const path of chartPaths) {
      const source = resolve(`${path}${mode === 'decrypt' ? '.enc' : ''}`);
      const destination = resolve(`${path}${mode === 'encrypt' ? '.enc' : ''}`);
      const filename = basename(destination);
      const output = join(staging, filename);
      if (mode === 'encrypt') validateJson(source);
      const result = spawnSync('openssl', [
        'enc', '-aes-256-cbc', mode === 'encrypt' ? '-e' : '-d', '-salt', '-pbkdf2',
        '-in', source, '-out', output, '-pass', 'env:DATA_KEY',
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      if (result.error || result.status !== 0) throw new Error(`Could not ${mode} ${basename(source)}; check DATA_KEY and the input file.`);
      if (mode === 'decrypt') validateJson(output);
      replacements.push({ output, destination });
    }
    // Never replace any existing output if conversion/validation of another input fails.
    for (const { output, destination } of replacements) renameSync(output, destination);
    console.log(`${mode}: ${replacements.length} chart files validated and replaced.`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

try {
  run(process.argv[2]);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Chart conversion failed');
  process.exitCode = 1;
}
