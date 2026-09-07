import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupDuplicates, hashFile } from '../src/core.mjs';
import { normalizeCapture, parseCaptureTime, groupRelated, relationshipCoverage, createRelatedReport } from '../src/relationships.mjs';
import { readCapture } from '../src/capture.mjs';

const raw = (extra = {}) => ({ DateTimeOriginal: '2026:09:07 10:20:00', OffsetTimeOriginal: '-07:00', SubSecTimeOriginal: '125', Make: 'Ditto', Model: 'Study Camera', BodySerialNumber: 'camera-1', ...extra });
const photo = (id, fields = {}, hash = id) => ({ id, name: `${id}.jpg`, path: `folder/${id}.jpg`, size: 100, hash, capture: normalizeCapture(raw(fields)) });

test('capture dates validate the calendar and never fall back to filesystem dates', () => {
  for (const date of ['2026:02:30 10:00:00', '2026:13:01 10:00:00', '2026:09:07 24:00:00', '0000:01:01 00:00:00', 'unknown']) assert.equal(parseCaptureTime(date), null);
  assert.ok(parseCaptureTime('2024:02:29 00:00:00'));
  assert.equal(parseCaptureTime('2026:09:07 10:00:00', 'nope'), null);
  assert.equal(parseCaptureTime('2026:09:07 10:00:00', '', '+25:00'), null);
  assert.deepEqual(groupRelated([{ ...photo('a'), capture: normalizeCapture({}), lastModified: 123 }, { ...photo('b'), capture: normalizeCapture({}), lastModified: 123 }]), []);
});

test('known time-zone offsets normalize to the same instant; unknown offsets stay separate', () => {
  const a = parseCaptureTime('2026:09:07 10:20:00', '100', '-07:00');
  const b = parseCaptureTime('2026:09:07 17:20:00', '1', '+00:00');
  const unknown = parseCaptureTime('2026:09:07 10:20:00');
  assert.equal(a.key, b.key);
  assert.equal(a.fraction, b.fraction);
  assert.notEqual(a.key, unknown.key);
  assert.equal(unknown.offset, null);
  assert.equal(parseCaptureTime('2026-09-07T10:20:00.125Z', '250'), null);
});

test('edits with preserved capture details are candidates, while exact groups remain separate', () => {
  const items = [photo('original'), photo('edit'), photo('backup', {}, 'original')];
  const related = groupRelated(items);
  assert.equal(related.length, 1);
  assert.equal(related[0].distinctContents, 2);
  assert.equal(related[0].hasConflicts, false);
  assert.equal(related[0].evidence[1].values[0].count, 2);
  assert.equal(groupDuplicates(items).length, 1);
  assert.equal(groupDuplicates(items)[0].extraBytes, 100);
  assert.deepEqual(groupRelated([photo('original'), photo('backup', {}, 'original')]), []);
  assert.equal('extraBytes' in related[0], false);
});

test('burst shots and device differences are visible conflicts, not confirmed identity', () => {
  const [group] = groupRelated([photo('a'), photo('b', { SubSecTimeOriginal: '250', Model: 'Other Camera', BodySerialNumber: 'camera-2' })]);
  assert.equal(group.hasConflicts, true);
  assert.deepEqual(group.evidence.slice(0, 3).map((field) => field.state), ['conflict', 'conflict', 'conflict']);
  assert.ok(group.warnings.some((text) => text.includes('burst')));
  assert.equal(group.kind, 'related');
});

test('date alone remains weak evidence and missing values never become matches', () => {
  const emptyFields = { Model: '', Make: '', BodySerialNumber: '0000', SubSecTimeOriginal: undefined, OffsetTimeOriginal: undefined };
  const [group] = groupRelated([photo('a', emptyFields), photo('b', emptyFields)]);
  assert.equal(group.timeOnly, true);
  assert.ok(group.evidence.every((field) => field.state === 'unknown'));
  assert.ok(group.warnings.some((text) => text.includes('whole seconds')));
  assert.ok(group.warnings.some((text) => text.includes('time-zone')));
  const [partlyKnown] = groupRelated([photo('known'), photo('unknown', { Model: '', Make: '', SubSecTimeOriginal: undefined, BodySerialNumber: '' })]);
  assert.equal(partlyKnown.evidence[1].state, 'unknown');
  assert.equal(partlyKnown.evidence[1].missing, 1);
});

test('GPS uses both coordinates and hemispheres, retains zero, and exposes differences', () => {
  const gps = { GPSLatitude: [0, 0, 0], GPSLatitudeRef: 'N', GPSLongitude: [0, 0, 0], GPSLongitudeRef: 'E' };
  assert.equal(normalizeCapture(raw(gps)).gps.display, '0.000000, 0.000000');
  assert.equal(normalizeCapture(raw({ ...gps, GPSLatitudeRef: '' })).gps, null);
  assert.equal(normalizeCapture(raw({ ...gps, GPSLatitude: [100, 0, 0] })).gps, null);
  const [group] = groupRelated([photo('a', gps), photo('b', { ...gps, GPSLongitude: [1, 0, 0], GPSLongitudeRef: 'W' })]);
  assert.equal(group.evidence[3].state, 'conflict');
  assert.ok(group.evidence[3].values.some((entry) => entry.value.includes('-1.000000')));
});

test('shared camera or GPS cannot bridge different capture times into one group', () => {
  const items = [photo('a'), photo('b'), photo('c', { DateTimeOriginal: '2026:09:07 10:20:01' }), photo('d', { DateTimeOriginal: '2026:09:07 10:20:01' })];
  assert.deepEqual(groupRelated(items).map((group) => group.items.map((item) => item.id)), [['a', 'b'], ['c', 'd']]);
});

test('study export retains uncertainty, evidence and assessment without changing exact results', () => {
  const items = [photo('a', { Model: '=FORMULA' }), photo('b', { Model: '=FORMULA' })];
  const groups = groupRelated(items);
  const csv = createRelatedReport(groups, { [groups[0].id]: 'different' });
  assert.ok(csv.includes('Possibly related — not confirmed'));
  assert.ok(csv.includes('Different photographs'));
  assert.ok(csv.includes('Camera serial number'));
  assert.deepEqual(groupDuplicates(items), []);
  assert.equal(groups[0].kind, 'related');
});

test('real encoded fixture metadata produces the planned study outcomes', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/study-01.json', import.meta.url), 'utf8'));
  const records = [];
  for (const entry of fixture.entries) {
    const file = new File([Buffer.from(entry.base64, 'base64')], entry.path.split('/').pop(), { type: 'image/jpeg' });
    records.push({ id: entry.path, name: file.name, path: entry.path, file, size: file.size, hash: await hashFile(file), capture: await readCapture(file) });
  }
  assert.equal(records.length, 11);
  const exact = groupDuplicates(records);
  assert.equal(exact.length, 1);
  assert.deepEqual(new Set(exact[0].items.map((item) => item.name)), new Set(['color-study.jpg', 'renamed-copy.jpg']));
  const related = groupRelated(records);
  assert.equal(related.length, 4);
  const color = related.find((group) => group.items.some((item) => item.name === 'color-study.jpg'));
  assert.equal(color.items.length, 4);
  assert.equal(color.distinctContents, 3);
  assert.equal(color.hasConflicts, false);
  assert.ok(color.evidence.every((field) => field.state === 'support'));
  assert.ok(related.find((group) => group.items.some((item) => item.name === 'burst-1.jpg')).hasConflicts);
  assert.ok(related.find((group) => group.items.some((item) => item.name === 'camera-a.jpg')).hasConflicts);
  assert.ok(related.find((group) => group.items.some((item) => item.name === 'time-a.jpg')).timeOnly);
  assert.equal(related.some((group) => group.items.some((item) => item.name === 'color-study-no-tags.jpg')), false);
  assert.deepEqual(relationshipCoverage(records), { eligible: 10, missingTime: 1, unavailable: 0 });
});
