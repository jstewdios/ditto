import { csvCell } from './core.mjs';

export const burstStatusLabels = {
  identified: 'Apple burst ID recorded',
  absent: 'No Apple burst ID found',
  unsupported: 'MakerNote format not supported',
  invalid: 'Apple burst metadata could not be read',
  unavailable: 'Burst metadata could not be checked',
};
const result = (status, uuid = null) => ({ status, uuid, source: uuid ? 'Apple MakerNote · BurstUUID (0x000b)' : null });

// Apple IFD begins at byte 14; value offsets are relative to the MakerNote.
// Format references: ExifTool MakerNotes.pm / MakerNoteApple and Apple.pm / 0x000b.
// Only this field is decoded. Live Photo IDs and sequence numbers are not burst IDs.
export function readAppleBurst(note) {
  if (note === undefined || note === null) return result('absent');
  if (!(note instanceof Uint8Array)) return result('invalid');
  const signature = [65, 112, 112, 108, 101, 32, 105, 79, 83, 0];
  if (!signature.every((value, index) => note[index] === value)) return result('unsupported');
  if (note.length < 16) return result('invalid');
  // Recognize the current Apple iOS MakerNote header; future variants remain unknown.
  if (note[10] !== 0 || note[11] !== 1) return result('unsupported');
  const little = note[12] === 73 && note[13] === 73;
  if (!little && !(note[12] === 77 && note[13] === 77)) return result('invalid');
  const view = new DataView(note.buffer, note.byteOffset, note.byteLength);
  const count = view.getUint16(14, little);
  const end = 16 + count * 12;
  if (count > 4096 || end > note.length) return result('invalid');
  let found = null;
  for (let entry = 16; entry < end; entry += 12) {
    if (view.getUint16(entry, little) !== 11) continue;
    if (found !== null) return result('invalid');
    const type = view.getUint16(entry + 2, little);
    const length = view.getUint32(entry + 4, little);
    const offset = view.getUint32(entry + 8, little);
    if (type !== 2 || ![36, 37].includes(length) || offset < end || offset > note.length - length) return result('invalid');
    if (length === 37 && note[offset + 36] !== 0) return result('invalid');
    const text = String.fromCharCode(...note.subarray(offset, offset + 36));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(text)) return result('invalid');
    found = text.toLowerCase();
  }
  return found ? result('identified', found) : result('absent');
}

const eligible = (item) => item.hash && item.size > 0 && !item.error;
export function groupBursts(records) {
  const buckets = new Map();
  for (const item of records) {
    const burst = item.capture?.burst;
    if (!eligible(item) || burst?.status !== 'identified' || !burst.uuid) continue;
    const id = `burst:apple:${burst.uuid}`;
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(item);
  }
  const groups = [];
  for (const [id, items] of buckets) {
    const byContent = new Map(items.map((item) => [`${item.size}:${item.hash}`, item]));
    const contentKeys = [...byContent.keys()];
    if (contentKeys.length < 2) continue;
    const representatives = [...byContent.values()];
    const conflicts = [];
    for (const [field, label] of [['camera', 'Camera descriptions'], ['serial', 'Camera serial numbers']]) {
      const values = new Set(representatives.map((item) => item.capture[field]).filter(Boolean).map((value) => field === 'camera' ? value.toLowerCase() : value));
      if (values.size > 1) conflicts.push(`${label} differ. Inspect these files; a shared ID is recorded metadata, not verified provenance.`);
    }
    groups.push({ id, kind: 'burst', uuid: items[0].capture.burst.uuid, items, contentKeys, distinctContents: contentKeys.length, conflicts });
  }
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

export function burstCoverage(records) {
  const counts = { identified: 0, absent: 0, unsupported: 0, invalid: 0, unavailable: 0 };
  for (const item of records.filter(eligible)) {
    const status = item.capture?.burst?.status;
    counts[Object.hasOwn(counts, status) ? status : 'unavailable']++;
  }
  return counts;
}

export function createBurstReport(records) {
  const groups = groupBursts(records);
  const memberships = new Map(groups.flatMap((group, index) => group.items.map((item) => [item.id, { group, number: index + 1 }])));
  const rows = [['Group', 'Relationship', 'Burst metadata status', 'Identifier source', 'Burst UUID', 'Different file contents in group', 'Cautions', 'Folder label', 'Relative path', 'File name', 'Bytes', 'SHA-256', 'Recorded capture time', 'Camera', 'Camera serial number']];
  for (const item of records.filter(eligible)) {
    const member = memberships.get(item.id);
    const burst = item.capture?.burst;
    rows.push([member?.number, member ? 'Shared recorded burst ID — not duplicate proof' : 'No multi-content burst group', burstStatusLabels[burst?.status] || burstStatusLabels.unavailable, burst?.source, burst?.uuid, member?.group.distinctContents, member?.group.conflicts.join(' | '), item.folderName, item.path, item.name, item.size, item.hash, item.capture?.time?.display, item.capture?.camera, item.capture?.serial]);
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
