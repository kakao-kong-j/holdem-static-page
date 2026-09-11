import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const names = ['gto-preflop-charts-all', 'gto-cache-preflop-chart', 'bencb-preflop-charts'];
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const testKey = 'synthetic-test-key';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'charts-crypto-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const publicDir = join(root, 'public');
  mkdirSync(publicDir);
  symlinkSync(fileURLToPath(new URL('.', import.meta.url)), join(root, 'scripts'), 'dir');
  const paths = names.map(name => join(publicDir, `${name}.json`));
  paths.forEach(path => writeFileSync(path, JSON.stringify({ fixture: path.split('/').pop(), text: 'x'.repeat(3000) })));
  const run = (mode, key = testKey) => {
    const env = { ...process.env };
    if (key === null) delete env.DATA_KEY;
    else env.DATA_KEY = key;
    return spawnSync('/bin/sh', ['-c', scripts[mode]], { cwd: root, env, encoding: 'utf8' });
  };
  const snapshot = suffix => paths.map(path => readFileSync(path + suffix));
  const unchanged = (before, suffix = '') => paths.forEach((path, i) => assert.equal(readFileSync(path + suffix).equals(before[i]), true, `${path} must remain unchanged`));
  const noTemps = () => assert.equal(readdirSync(publicDir).filter(name => !names.some(base => name === `${base}.json` || name === `${base}.json.enc`)).length, 0);
  return { paths, run, snapshot, unchanged, noTemps };
}

test('round-trips all chart files and removes staging files', t => {
  const f = fixture(t); const before = f.snapshot('');
  assert.equal(f.run('encrypt').status, 0);
  f.paths.forEach(path => rmSync(path));
  assert.equal(f.run('decrypt').status, 0);
  f.unchanged(before); f.noTemps();
});

test('corrupt last ciphertext preserves every existing plaintext', t => {
  const f = fixture(t); assert.equal(f.run('encrypt').status, 0);
  const before = f.snapshot('');
  const path = f.paths[2] + '.enc'; const bytes = readFileSync(path);
  writeFileSync(path, bytes.subarray(0, bytes.length - 1));
  assert.notEqual(f.run('decrypt').status, 0);
  f.unchanged(before); f.noTemps();
});

test('wrong key leaves all existing plaintext untouched', t => {
  const f = fixture(t); assert.equal(f.run('encrypt').status, 0);
  const before = f.snapshot('');
  assert.notEqual(f.run('decrypt', 'wrong-test-key').status, 0);
  f.unchanged(before); f.noTemps();
});

test('invalid decrypted JSON does not replace plaintext', t => {
  const f = fixture(t); assert.equal(f.run('encrypt').status, 0);
  const before = f.snapshot('');
  const cipher = spawnSync('openssl', ['enc', '-aes-256-cbc', '-e', '-salt', '-pbkdf2', '-out', f.paths[2] + '.enc', '-pass', 'env:DATA_KEY'], { env: { ...process.env, DATA_KEY: testKey }, input: 'not json' });
  assert.equal(cipher.status, 0);
  assert.notEqual(f.run('decrypt').status, 0);
  f.unchanged(before); f.noTemps();
});

test('invalid last plaintext preserves all existing ciphertext', t => {
  const f = fixture(t); assert.equal(f.run('encrypt').status, 0);
  const before = f.snapshot('.enc');
  writeFileSync(f.paths[2], 'not json');
  assert.notEqual(f.run('encrypt').status, 0);
  f.unchanged(before, '.enc'); f.noTemps();
});

test('missing or empty key rejects both operations before changing files', t => {
  const f = fixture(t); assert.equal(f.run('encrypt').status, 0);
  const plain = f.snapshot(''); const cipher = f.snapshot('.enc');
  for (const mode of ['encrypt', 'decrypt']) for (const key of [null, '']) assert.notEqual(f.run(mode, key).status, 0);
  f.unchanged(plain); f.unchanged(cipher, '.enc'); f.noTemps();
});
