import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import exifr from 'exifr';
import { hashFile, groupDuplicates } from '../src/core.mjs';
import { readCapture } from '../src/capture.mjs';
import { groupRelated } from '../src/relationships.mjs';
import { readAppleBurst, groupBursts, burstCoverage, createBurstReport } from '../src/bursts.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/study-02.json', import.meta.url), 'utf8'));
const records = await Promise.all(fixture.entries.map(async (entry) => {
  const file = new File([Buffer.from(entry.base64, 'base64')], entry.path.split('/').pop(), { type: 'image/jpeg' });
  return { id: entry.path, name: file.name, path: entry.path, folderName: entry.path.split('/')[0], file, size: file.size, hash: await hashFile(file), capture: await readCapture(file) };
}));
const original = records[0];
const raw = await exifr.parse(await original.file.arrayBuffer(), { pick: ['MakerNote'], makerNote: true });
const note = raw.makerNote;

test('encoded Apple MakerNotes join across seconds and missing times, without merging simultaneous bursts', () => {
  const groups = groupBursts(records);
  assert.deepEqual(groups.map((group) => [group.items.length, group.distinctContents]), [[5, 4], [2, 2]]);
  assert.equal(new Set(groups[0].items.filter((item) => item.capture.time).map((item) => item.capture.time.key)).size, 2);
  assert.ok(groups[0].items.some((item) => item.capture.time === null));
  assert.ok(groups.every((group) => group.items.every((item) => item.capture.burst.uuid === group.uuid)));
  assert.equal(groups[0].conflicts.length, 0);
  assert.ok(records.every((item) => !('makerNote' in item.capture)));
  const grouped = new Set(groups.flatMap((group) => group.items.map((item) => item.name)));
  for (const name of ['moment-1-stripped.jpg', 'sequence-only.jpg', 'invalid-id.jpg', 'singleton.jpg', 'live-photo-id.jpg']) assert.equal(grouped.has(name), false, name);
});

test('exact copies remain exact, and duplicate-only IDs do not manufacture burst groups', () => {
  const exact = groupDuplicates(records);
  assert.equal(exact.length, 1);
  assert.deepEqual(exact[0].items.map((item) => item.name), ['moment-1.jpg', 'renamed-moment-1.jpg']);
  assert.deepEqual(groupBursts(exact[0].items), []);
  assert.ok(groupBursts(records).every((group) => !('extraBytes' in group)));
  const withoutBurst = records.map((item) => ({ ...item, capture: { ...item.capture, burst: undefined } }));
  assert.deepEqual(groupRelated(records).map((group) => group.contentKeys), groupRelated(withoutBurst).map((group) => group.contentKeys));
});

test('Apple reader handles embedded byte views and either declared byte order', () => {
  const padded = new Uint8Array(note.length + 16);
  padded.set(note, 8);
  assert.deepEqual(readAppleBurst(padded.subarray(8, 8 + note.length)), readAppleBurst(note));
  const little = note.slice();
  little[12] = little[13] = 73;
  const bigView = new DataView(note.buffer, note.byteOffset, note.byteLength);
  const littleView = new DataView(little.buffer);
  for (const offset of [14, 16, 18]) littleView.setUint16(offset, bigView.getUint16(offset), true);
  for (const offset of [20, 24]) littleView.setUint32(offset, bigView.getUint32(offset), true);
  assert.deepEqual(readAppleBurst(little), readAppleBurst(note));
  little.set(new TextEncoder().encode('AABBCCDD-ABCD-4ABC-8ABC-ABCDEFABCDEF'), 32);
  assert.equal(readAppleBurst(little).uuid, 'aabbccdd-abcd-4abc-8abc-abcdefabcdef');
});

test('malformed notes never yield IDs or throw: truncation, pointers, types, placeholders, duplicate tags', () => {
  for (const length of [10, 15, 17, 31, note.length - 1]) assert.equal(readAppleBurst(note.slice(0, length)).uuid, null);
  for (const [offset, width, value] of [[14, 2, 65535], [18, 2, 7], [20, 4, 0xffffffff], [24, 4, 0xffffffff], [24, 4, 4]]) {
    const broken = note.slice(); new DataView(broken.buffer)[width === 2 ? 'setUint16' : 'setUint32'](offset, value);
    assert.equal(readAppleBurst(broken).status, 'invalid');
  }
  const duplicate = new Uint8Array(85); duplicate.set(note.subarray(0, 28));
  const view = new DataView(duplicate.buffer); view.setUint16(14, 2); view.setUint32(24, 48);
  duplicate.set(duplicate.subarray(16, 28), 28); duplicate.set(note.subarray(32), 48);
  assert.equal(readAppleBurst(duplicate).status, 'invalid');
  const noTerminator = note.slice(); noTerminator[noTerminator.length - 1] = 65;
  assert.equal(readAppleBurst(noTerminator).status, 'invalid');
  const future = note.slice(); future[11] = 2;
  assert.equal(readAppleBurst(future).status, 'unsupported');
  assert.equal(readAppleBurst(new Uint8Array([1, 2])).status, 'unsupported');
  assert.equal(readAppleBurst(undefined).status, 'absent');
  const invalid = records.find((item) => item.name === 'invalid-id.jpg');
  assert.equal(invalid.capture.burst.status, 'invalid');
  assert.ok(invalid.capture.time, 'bad burst metadata does not discard ordinary capture details');
});

test('coverage and export expose all checked files, including stripped exports and singleton IDs', () => {
  assert.deepEqual(burstCoverage(records), { identified: 8, absent: 2, unsupported: 1, invalid: 1, unavailable: 0 });
  const csv = createBurstReport(records);
  assert.equal(csv.trim().split('\r\n').length, 13);
  for (const item of records) assert.ok(csv.includes(item.path));
  assert.ok(csv.includes('MakerNote format not supported'));
  assert.ok(csv.includes('Shared recorded burst ID — not duplicate proof'));
  const injection = createBurstReport([{ ...original, path: '=FORMULA()' }]);
  assert.ok(injection.includes("'=FORMULA()"));
  const unreadable = { ...original, error: 'read failed' };
  assert.deepEqual(groupBursts([unreadable, records[1]]), []);
  assert.equal(burstCoverage([unreadable]).identified, 0);
});

test('camera conflicts remain visible and metadata reads stay bounded', async () => {
  const changed = { ...records[1], capture: { ...records[1].capture, camera: 'Other camera', serial: 'other' } };
  const [group] = groupBursts([original, changed]);
  assert.ok(group.conflicts.some((text) => text.includes('Camera descriptions')));
  const bounds = [];
  await readCapture({ slice(start, end) { bounds.push([start, end]); return original.file; } });
  assert.deepEqual(bounds, [[0, 1024 * 1024]]);
  const failed = await readCapture({ slice() { throw new Error('read failed'); } });
  assert.equal(failed.burst.status, 'unavailable');
  assert.equal(failed.status, 'unavailable');
});
