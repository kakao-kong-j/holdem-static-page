import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateImages, imageContentType, sourceIds } from './migrate-flop-images.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const data = (...ids) => ({ records: ids.map(id => ({ source: { url: id === null ? null : `https://drive.google.com/file/d/${id}/view?usp=drive_link` } })) });
const origin = 'https://synthetic.public.blob.vercel-storage.com/';
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'flop-images-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const outputPath = join(dir, 'manifest.json');
  const stored = new Map();
  const blob = {
    async list() { return { blobs: [...stored.values()], hasMore: false }; },
    async head(url) {
      const entry = [...stored.values()].find(b => b.url === url);
      if (!entry) throw new Error('not found');
      return entry;
    },
    async put(pathname, bytes, options) {
      assert.equal(options.access, 'public');
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.allowOverwrite, false);
      if (stored.has(pathname)) throw new Error('duplicate upload');
      const entry = { pathname, url: origin + pathname, size: bytes.length, contentType: options.contentType };
      stored.set(pathname, entry);
      return entry;
    },
  };
  return { outputPath, checkpointPath: join(dir, 'progress.local'), stored, blob };
}

test('deduplicates exact Drive IDs and rejects foreign URLs before migration', () => {
  assert.deepEqual(sourceIds(data('one', 'two', 'one', null)), ['one', 'two']);
  for (const url of ['https://evil.test/file/d/one/view', 'http://drive.google.com/file/d/one/view', 'https://drive.google.com/file/d/../view']) {
    assert.throws(() => sourceIds({ records: [{ source: { url } }] }));
  }
});

test('rejects an HTML permission page even when the server claims image/png', () => {
  assert.equal(imageContentType(png), 'image/png');
  assert.throws(() => imageContentType(Buffer.from('<html>Permission required</html>')));
});

test('uploads each image once, verifies storage and resumes without downloading again', async t => {
  const f = setup(t);
  let downloads = 0;
  const fetchImpl = async url => {
    assert.equal(new URL(url).hostname, 'drive.google.com');
    downloads++;
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  };
  const options = { ...f, data: data('one', 'two', 'one'), fetchImpl, retryDelayMs: 0 };
  const first = await migrateImages(options);
  assert.equal(first.complete, true);
  assert.equal(downloads, 2);
  assert.deepEqual(JSON.parse(readFileSync(f.outputPath)), { schema_version: 1, images: {
    one: origin + 'flop-cbet/one', two: origin + 'flop-cbet/two',
  } });
  assert.equal((await migrateImages(options)).complete, true);
  assert.equal(downloads, 2);
});

test('a failed download preserves the published index and can resume uploaded files', async t => {
  const f = setup(t);
  writeFileSync(f.outputPath, 'previous index');
  const options = { ...f, data: data('one', 'two'), concurrency: 1, retryDelayMs: 0 };
  const failed = await migrateImages({ ...options, fetchImpl: async url => new URL(url).searchParams.get('id') === 'one'
    ? new Response(png) : new Response('<html>denied</html>') });
  assert.equal(failed.complete, false);
  assert.equal(failed.failed.length, 1);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'previous index');
  assert.equal(f.stored.size, 1);
  const resumed = await migrateImages({ ...options, fetchImpl: async url => {
    assert.equal(new URL(url).searchParams.get('id'), 'two');
    return new Response(png);
  } });
  assert.equal(resumed.complete, true);
  assert.equal(f.stored.size, 2);
});

test('a limited run never publishes an incomplete manifest', async t => {
  const f = setup(t);
  writeFileSync(f.outputPath, 'previous index');
  const result = await migrateImages({ ...f, data: data('one', 'two'), limit: 1, fetchImpl: async () => new Response(png) });
  assert.equal(result.complete, false);
  assert.equal(f.stored.size, 1);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'previous index');
});

test('does not publish a blob whose uploaded size cannot be verified', async t => {
  const f = setup(t);
  f.blob.head = async url => ({ url, size: 1, contentType: 'image/png' });
  writeFileSync(f.outputPath, 'previous index');
  const result = await migrateImages({ ...f, data: data('one'), retryDelayMs: 0, fetchImpl: async () => new Response(png) });
  assert.equal(result.complete, false);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'previous index');
});

test('a previously rejected upload remains rejected on resume', async t => {
  const f = setup(t);
  const put = f.blob.put;
  f.blob.put = async (...args) => {
    const result = await put(...args);
    result.size = 100;
    return result;
  };
  writeFileSync(f.outputPath, 'previous index');
  const options = { ...f, data: data('one'), retryDelayMs: 0, fetchImpl: async () => new Response(png) };
  assert.equal((await migrateImages(options)).complete, false);
  assert.equal((await migrateImages(options)).complete, false);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'previous index');
});

test('stops the batch immediately when the Blob store is suspended', async t => {
  const f = setup(t);
  writeFileSync(f.outputPath, 'previous index');
  f.blob.put = async () => { throw new Error('Vercel Blob: This store has been suspended.'); };
  const result = await migrateImages({ ...f, data: data('one', 'two', 'three'), concurrency: 1, retryDelayMs: 0, fetchImpl: async () => new Response(png) });
  assert.equal(result.complete, false);
  assert.equal(result.stoppedReason, 'store-suspended');
  assert.equal(result.failed.length, 1);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'previous index');
});
