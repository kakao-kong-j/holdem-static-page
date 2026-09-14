import { readFileSync, writeFileSync, appendFileSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import * as vercelBlob from '@vercel/blob';

const prefix = 'flop-cbet/';
const maxBytes = 20 * 1024 * 1024;
const isSuspended = error => error instanceof Error && /store has been suspended/i.test(error.message);

export function sourceIds(data) {
  if (!Array.isArray(data?.records) || !data.records.length) throw new Error('Missing strategy records');
  const ids = new Set();
  for (const record of data.records) {
    if (record?.source?.url === null) continue;
    const url = new URL(record?.source?.url);
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)\/?$/)?.[1];
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || url.port || !id) {
      throw new Error('Invalid source URL');
    }
    ids.add(id);
  }
  if (!ids.size) throw new Error('No source images');
  return [...ids].sort();
}

export function imageContentType(bytes) {
  if (bytes.length >= 32 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes.length >= 32 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 32 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.length >= 32 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new Error('Response is not a supported image');
}

async function download(id, fetchImpl) {
  const response = await fetchImpl(`https://drive.google.com/uc?export=download&id=${id}`, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new Error('Image exceeds 20 MiB');
  }
  if (!response.body) throw new Error('Empty image response');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Image exceeds 20 MiB');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return { bytes, contentType: imageContentType(bytes) };
}

function validBlob(meta, id) {
  const url = new URL(meta.url);
  return url.protocol === 'https:' && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
    && !url.username && !url.password && !url.port && !url.search && !url.hash
    && url.pathname === `/${prefix}${id}` && meta.pathname === `${prefix}${id}`
    && Number.isInteger(meta.size) && meta.size >= 32 && meta.size <= maxBytes
    && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(meta.contentType);
}

export async function migrateImages({ data, outputPath, checkpointPath, blob = vercelBlob, fetchImpl = fetch,
  concurrency = 4, limit = Infinity, retryDelayMs = 1000, onProgress = () => {} }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8
    || (limit !== Infinity && (!Number.isInteger(limit) || limit < 1))) throw new Error('Invalid concurrency or limit');
  const ids = sourceIds(data);
  const verified = new Map();
  if (checkpointPath) {
    try {
      for (const line of readFileSync(checkpointPath, 'utf8').split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if (typeof entry.id === 'string' && validBlob(entry, entry.id)) verified.set(entry.id, entry);
        } catch { /* An interrupted final append is reverified from the source. */ }
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    mkdirSync(dirname(checkpointPath), { recursive: true });
  }
  const existing = new Map();
  let cursor;
  do {
    const page = await blob.list({ prefix, cursor, limit: 1000 });
    for (const entry of page.blobs) existing.set(entry.pathname, entry);
    cursor = page.hasMore ? page.cursor : undefined;
    if (page.hasMore && !cursor) throw new Error('Missing Blob pagination cursor');
  } while (cursor);
  const images = {};
  const failed = [];
  let next = 0;
  let uploaded = 0;
  let reused = 0;
  let totalBytes = 0;
  let stoppedReason = null;
  const selected = ids.slice(0, limit);
  async function retry(operation) {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (attempt === 2 || isSuspended(error)) throw error;
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }
  async function worker() {
    while (next < selected.length && failed.length < 20 && !stoppedReason) {
      const id = selected[next++];
      let stage = 'download';
      try {
        const old = existing.get(`${prefix}${id}`);
        let meta;
        if (old) {
          stage = 'verify-existing';
          meta = await retry(() => blob.head(old.url));
          if (!validBlob(meta, id) || meta.size !== old.size) throw new Error('Invalid existing image');
          const receipt = verified.get(id);
          if (!receipt || receipt.url !== meta.url || receipt.size !== meta.size || receipt.contentType !== meta.contentType) {
            // Unverified uploads (including interrupted or rejected ones) must match the original.
            const original = await retry(() => download(id, fetchImpl));
            if (meta.size !== original.bytes.length || meta.contentType !== original.contentType) throw new Error('Existing upload differs from source');
          }
          reused++;
        } else {
          const { bytes, contentType } = await retry(() => download(id, fetchImpl));
          stage = 'upload';
          // Never overwrite. If an interrupted upload succeeded, the next run finds it via list().
          const result = await blob.put(`${prefix}${id}`, bytes, {
            access: 'public', addRandomSuffix: false, allowOverwrite: false,
            contentType, cacheControlMaxAge: 31536000,
          });
          stage = 'verify-upload';
          meta = await retry(() => blob.head(result.url));
          if (!validBlob(meta, id) || meta.size !== bytes.length || meta.contentType !== contentType) throw new Error('Upload verification failed');
          uploaded++;
        }
        if (checkpointPath && !verified.has(id)) {
          appendFileSync(checkpointPath, '\n' + JSON.stringify({ id, url: meta.url, pathname: meta.pathname, size: meta.size, contentType: meta.contentType }) + '\n', { mode: 0o600 });
        }
        images[id] = meta.url;
        totalBytes += meta.size;
      } catch (error) {
        // SDK/network errors may include request details. Log only an ID and processing stage.
        if (isSuspended(error)) stoppedReason = 'store-suspended';
        failed.push({ id, stage });
      }
      onProgress({ done: Object.keys(images).length, total: ids.length, uploaded, reused, failed: failed.length, totalBytes });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const complete = Object.keys(images).length === ids.length && !failed.length;
  if (complete) {
    const manifest = { schema_version: 1, images: Object.fromEntries(ids.map(id => [id, images[id]])) };
    mkdirSync(dirname(outputPath), { recursive: true });
    const temp = `${outputPath}.${process.pid}.tmp`;
    try {
      writeFileSync(temp, JSON.stringify(manifest) + '\n', { flag: 'wx' });
      renameSync(temp, outputPath);
    } finally { rmSync(temp, { force: true }); }
  }
  return { complete, total: ids.length, uploaded, reused, totalBytes, failed, stoppedReason };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required');
    const args = Object.fromEntries(process.argv.slice(2).map(arg => {
      const match = arg.match(/^--(limit|concurrency)=(\d+)$/);
      if (!match) throw new Error('Usage: npm run migrate:flop-images -- [--limit=N] [--concurrency=1..8]');
      return [match[1], Number(match[2])];
    }));
    let lastReport = 0;
    const result = await migrateImages({
      data: JSON.parse(readFileSync('public/tournament-flop-cbet.json', 'utf8')),
      outputPath: resolve('public/flop-cbet-images.json'), ...args,
      checkpointPath: resolve('output/flop-cbet-images/progress.local'),
      onProgress(progress) {
        if (Date.now() - lastReport > 15000 || progress.done === progress.total) {
          console.log(JSON.stringify(progress)); lastReport = Date.now();
        }
      },
    });
    console.log(JSON.stringify(result));
    if ((!result.complete && !args.limit) || result.failed.length) process.exitCode = 1;
  } catch {
    console.error('Image migration failed. Check arguments, source JSON, network access and BLOB_READ_WRITE_TOKEN.');
    process.exitCode = 1;
  }
}
