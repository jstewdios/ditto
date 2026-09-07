import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashFile, groupDuplicates, createReport, isPhoto, readEntry } from '../src/core.mjs';
import { readDimensions } from '../src/dimensions.mjs';

test('renamed files match by contents; same-name and same-size different contents do not', async () => {
  const fileA = new File(['photo content'], 'original.JPG');
  const fileB = new File(['photo content'], 'renamed.jpg');
  const fileC = new File(['other content'], 'original.JPG');
  const records = await Promise.all([fileA, fileB, fileC].map(async (file, index) => ({ id: index, name: file.name, size: file.size, hash: await hashFile(file) })));
  const groups = groupDuplicates(records);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map((item) => item.name), ['original.JPG', 'renamed.jpg']);
  assert.equal(groups[0].extraBytes, fileA.size);
});

test('streamed hashing matches an independent SHA-256 across multiple chunks', async () => {
  const bytes = new Uint8Array(5 * 1024 * 1024 + 19);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
  const chunks = [];
  const hash = await hashFile(new Blob([bytes]), (count) => chunks.push(count));
  assert.equal(hash, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(chunks.reduce((sum, count) => sum + count, 0), bytes.length);
  assert.ok(chunks.length > 1);
  assert.ok(Math.max(...chunks) <= 2 * 1024 * 1024);
  bytes[bytes.length - 1] ^= 1;
  assert.notEqual(await hashFile(new Blob([bytes])), hash);
});

test('unreadable files reject and empty or failed files never become matches', async () => {
  await assert.rejects(hashFile({ size: 1, slice: () => ({ arrayBuffer: async () => { throw new Error('disconnected'); } }) }), /disconnected/);
  assert.deepEqual(groupDuplicates([{ size: 0, hash: 'empty' }, { size: 0, hash: 'empty' }, { size: 2, error: 'failed', hash: 'x' }, { size: 2, hash: 'x' }]), []);
});

test('groups prioritize extra bytes and count only copies beyond one per group', () => {
  const groups = groupDuplicates([{ size: 5, hash: 'a' }, { size: 5, hash: 'a' }, { size: 3, hash: 'b' }, { size: 3, hash: 'b' }, { size: 3, hash: 'b' }]);
  assert.deepEqual(groups.map((group) => group.extraBytes), [6, 5]);
});

test('CSV retains Unicode, commas, quotes, and line breaks while neutralizing formulas', () => {
  const csv = createReport([{ items: [{ folderName: '旅行', path: '旅行/a,"b"\nc.jpg', name: '=HYPERLINK("x")', size: 13, lastModified: 0, hash: 'hash' }, { name: '\t+formula', size: 13 }]}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"旅行/a,""b""\nc.jpg"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'\t+formula"'));
});

test('nested folder drops read every batch and preserve paths', async () => {
  const fileEntry = (name) => ({ name, isFile: true, file: (done) => done(new File(['x'], name)) });
  const directory = (name, batches) => ({ name, isDirectory: true, createReader: () => { let index = 0; return { readEntries: (done) => done(batches[index++] || []) }; } });
  const root = directory('Photos', [[fileEntry('one.jpg')], [directory('Trip', [[fileEntry('two.png')]])], [fileEntry('three.jpg')]]);
  const files = await readEntry(root);
  assert.deepEqual(files.map((entry) => entry.path), ['Photos/one.jpg', 'Photos/Trip/two.png', 'Photos/three.jpg']);
  await assert.rejects(readEntry({ name: 'locked.jpg', isFile: true, file: (_, reject) => reject(new Error('denied')) }), /denied/);
});

test('extension recognition includes photos and raw files and excludes non-photos', () => {
  for (const name of ['photo.JPG', 'photo.heic', 'photo.CR3', 'photo.NEF', 'photo.webp']) assert.ok(isPhoto({ name }));
  for (const name of ['photo.jpg.exe', 'clip.mp4', 'notes.txt', '.DS_Store', 'vector.svg']) assert.equal(isPhoto({ name }), false);
});

test('image dimensions come from headers, not resized previews', () => {
  const png = new Uint8Array(24); const view = new DataView(png.buffer);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]); png.set([73, 72, 68, 82], 12);
  view.setUint32(16, 6000); view.setUint32(20, 4000);
  assert.deepEqual(readDimensions(png.buffer), { width: 6000, height: 4000 });
  const jpg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 194, 0, 8, 8, 15, 160, 23, 112, 0, 255, 217]);
  assert.deepEqual(readDimensions(jpg.buffer), { width: 6000, height: 4000 });
  assert.deepEqual(readDimensions(new Uint8Array([255, 216, 255, 194, 0]).buffer), {});
  assert.deepEqual(readDimensions(new ArrayBuffer(0)), {});
});
