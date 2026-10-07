import { csvCell } from './core.mjs';

const comparable = (record) => !!(record && record.hash && !record.error && record.size > 0);
const contentKey = (record) => `${record.size}:${record.hash}`;
const byPath = (a, b) => String(a.path).localeCompare(String(b.path)) || String(a.id).localeCompare(String(b.id));

// Exact Archive membership uses the same size and SHA-256 key as exact copies.
// Incoming bytes are the space those Incoming files occupy, not a removal recommendation.
/**
 * @param {Array<{ id: string, folderId: string, folderName: string, name: string, path: string, size: number, hash?: string, error?: string }>} records
 * @param {Record<string, string>} roles
 * @param {Array<{ items?: Array<{ id: string, folderId: string, size: number, hash?: string, error?: string }> }>} [relatedGroups]
 * @returns {import('./types').ArchiveCheck}
 */
export function archiveCheck(records, roles = {}, relatedGroups = []) {
  const roleOf = (record) => record && roles[record.folderId];
  const eligible = records.filter(comparable);
  const archive = eligible.filter((record) => roleOf(record) === 'archive');
  const incoming = eligible.filter((record) => roleOf(record) === 'incoming');
  const archiveByKey = new Map();
  for (const record of archive) {
    const key = contentKey(record);
    if (!archiveByKey.has(key)) archiveByKey.set(key, []);
    archiveByKey.get(key).push(record);
  }
  for (const copies of archiveByKey.values()) copies.sort(byPath);

  const groupsByKey = new Map();
  const matchedIds = new Set();
  for (const record of incoming) {
    const key = contentKey(record);
    const counterparts = archiveByKey.get(key);
    if (!counterparts) continue;
    matchedIds.add(record.id);
    if (!groupsByKey.has(key)) groupsByKey.set(key, { id: key, incoming: [], archive: counterparts, bytes: 0 });
    const group = groupsByKey.get(key);
    group.incoming.push(record);
    group.bytes += record.size;
  }
  for (const group of groupsByKey.values()) group.incoming.sort(byPath);
  const groups = [...groupsByKey.values()].sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id));
  const claimUnique = archive.length > 0;
  const unique = claimUnique ? incoming.filter((record) => !matchedIds.has(record.id)).sort((a, b) => b.size - a.size || byPath(a, b)) : [];
  const weakerIds = new Set();
  for (const group of relatedGroups) {
    const items = group?.items || [];
    if (!items.some((item) => roleOf(item) === 'archive' && comparable(item))) continue;
    for (const item of items) {
      if (roleOf(item) === 'incoming' && comparable(item) && !matchedIds.has(item.id) && !archiveByKey.has(contentKey(item))) weakerIds.add(item.id);
    }
  }
  const unchecked = (role) => records.filter((record) => roleOf(record) === role && !comparable(record)).length;
  return {
    archiveChecked: archive.length,
    incomingChecked: incoming.length,
    uncheckedArchive: unchecked('archive'),
    uncheckedIncoming: unchecked('incoming'),
    alreadyCount: matchedIds.size,
    duplicatedBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
    uniqueCount: unique.length,
    weakerCount: weakerIds.size,
    groups,
    unique,
  };
}

// Roles apply only while Archive vs Incoming is on. Stored roles do not affect the default result.
export function rolesForCheck(enabled, folders) {
  if (!enabled) return {};
  const roles = {};
  for (const folder of folders) {
    if (folder?.role === 'archive' || folder?.role === 'incoming') roles[folder.id] = folder.role;
  }
  return roles;
}

// Turning the workflow on opens its summary. Turning it off leaves Exact copies when that summary was open.
/** @param {boolean} enabled @param {'archive' | 'exact' | 'related' | 'burst'} view @returns {'archive' | 'exact' | 'related' | 'burst'} */
export function viewAfterArchiveMode(enabled, view) {
  if (enabled) return 'archive';
  return view === 'archive' ? 'exact' : view;
}

export function createArchiveReport(check) {
  const rows = [['Status', 'Incoming folder', 'Relative path', 'File name', 'Bytes', 'SHA-256', 'Archive counterpart folders', 'Archive counterpart paths']];
  const push = (record, status, archive) => rows.push([
    status, record.folderName, record.path, record.name, record.size, record.hash,
    archive.map((item) => item.folderName).join(' | '), archive.map((item) => item.path).join(' | '),
  ]);
  check.groups.forEach((group) => group.incoming.forEach((record) => push(record, 'Exact copy in Archive', group.archive)));
  check.unique.forEach((record) => push(record, 'No exact copy in checked Archive', []));
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
