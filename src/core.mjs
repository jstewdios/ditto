import { createSHA256 } from 'hash-wasm';

export const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|avif|heic|heif|tiff?|gif|bmp|dng|cr2|cr3|nef|arw|orf|raf|rw2|pef|srw)$/i;
export const isPhoto = (file) => PHOTO_EXTENSIONS.test(file.name);

// Study 04: Accept all file types for exact-copy comparison.
// Photo-specific features (metadata, relationships, bursts) still require photo formats.
export const isValidFile = (file) => file.size > 0;

// Study 05: File type categorization for filtering
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|flac|wav|ogg|opus|wma|aiff?|ape|alac)$/i;
const DOCUMENT_EXTENSIONS = /\.(pdf|docx?|txt|rtf|odt|md|tex|pages|epub|mobi|xlsx?|pptx?|csv|tsv|json|xml|html?|css|js|ts|jsx|tsx|vue|py|java|cpp|c|h|swift|rb|go|rs|php|sh|bat|ps1)$/i;

export const getFileCategory = (file) => {
  const name = typeof file === 'string' ? file : file.name;
  if (isPhoto({ name })) return 'photos';
  if (AUDIO_EXTENSIONS.test(name)) return 'audio';
  if (DOCUMENT_EXTENSIONS.test(name)) return 'documents';
  return 'other';
};

// Bounded reads keep a large photo from becoming a large ArrayBuffer allocation.
/** @param {Blob} file @param {(bytes: number) => void} onBytes */
export async function hashFile(file, onBytes = () => {}) {
  const hasher = await createSHA256();
  hasher.init();
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    hasher.update(chunk);
    onBytes(chunk.byteLength);
  }
  return hasher.digest('hex');
}

export function groupDuplicates(records) {
  const buckets = new Map();
  for (const record of records) {
    if (!record.hash || record.error || record.size === 0) continue;
    const key = `${record.size}:${record.hash}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  }
  return [...buckets.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([id, items]) => ({ id, items, extraBytes: (items.length - 1) * items[0].size }))
    .sort((a, b) => b.extraBytes - a.extraBytes || a.id.localeCompare(b.id));
}

export function csvCell(value) {
  const text = String(value ?? '');
  // Neutralize formulas when opening a locally exported report in a spreadsheet.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function createReport(groups) {
  const rows = [['Group', 'Match', 'Folder label', 'Relative path', 'File name', 'Bytes', 'File modified (ISO)', 'SHA-256']];
  groups.forEach((group, index) => {
    group.items.forEach((item) => rows.push([
      index + 1, 'Identical file content', item.folderName, item.path, item.name, item.size,
      item.lastModified ? new Date(item.lastModified).toISOString() : '', item.hash,
    ]));
  });
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const formatBytes = (value) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1000)), units.length - 1);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: index ? 1 : 0 }).format(value / 1000 ** index)} ${units[index]}`;
};

// Directory readers return batches, not necessarily the whole directory at once.
export async function readEntry(entry, prefix = '') {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ file, path: `${prefix}${entry.name}` }];
  }
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const result = [];
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    for (const child of batch) result.push(...await readEntry(child, `${prefix}${entry.name}/`));
  }
  return result;
}
