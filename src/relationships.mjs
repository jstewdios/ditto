import { csvCell } from './core.mjs';

const clean = (value) => typeof value === 'string' && value.length <= 512 ? value.replaceAll('\0', '').trim().replace(/\s+/g, ' ') : '';
const serial = (value) => {
  const text = clean(value);
  return /^(0+|unknown|n\/?a|none|null|undefined)$/i.test(text) ? '' : text;
};

// Missing offsets are never interpreted using the current computer's time zone.
// A second is a candidate bucket, not a claim that all its files are one shot.
export function parseCaptureTime(date, subsecond, offset) {
  const text = clean(date);
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, inlineFraction, inlineOffset] = match;
  const values = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, s] = values;
  if (y < 1 || m < 1 || m > 12 || d < 1 || h > 23 || min > 59 || s > 59) return null;
  const clock = new Date(0);
  clock.setUTCFullYear(y, m - 1, d);
  clock.setUTCHours(h, min, s, 0);
  if (clock.getUTCFullYear() !== y || clock.getUTCMonth() !== m - 1 || clock.getUTCDate() !== d) return null;
  const fractionTag = clean(subsecond);
  if (fractionTag && !/^\d{1,12}$/.test(fractionTag)) return null;
  const normalizeFraction = (value) => value?.replace(/0+$/, '') || (value ? '0' : null);
  if (inlineFraction && fractionTag && normalizeFraction(inlineFraction) !== normalizeFraction(fractionTag)) return null;
  const fraction = normalizeFraction(fractionTag || inlineFraction);
  const offsetTag = clean(offset);
  const normalizedOffset = (value) => value === 'Z' || value === '+00:00' || value === '-00:00' ? '+00:00' : value;
  if (inlineOffset && offsetTag && normalizedOffset(inlineOffset) !== normalizedOffset(offsetTag)) return null;
  const zone = normalizedOffset(offsetTag || inlineOffset || '');
  let zoneMinutes = null;
  if (zone) {
    const z = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
    if (!z || Number(z[2]) > 14 || Number(z[3]) > 59 || (Number(z[2]) === 14 && Number(z[3]) > 0)) return null;
    zoneMinutes = (Number(z[2]) * 60 + Number(z[3])) * (z[1] === '-' ? -1 : 1);
  }
  const wall = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  const utc = zoneMinutes === null ? null : clock.getTime() - zoneMinutes * 60_000;
  return {
    key: utc === null ? `wall:${wall}` : `utc:${utc}`,
    label: utc === null ? `${wall} · offset not recorded` : new Date(utc).toISOString().replace('T', ' ').replace('.000Z', ' UTC'),
    display: `${wall}${fraction === null ? '' : `.${fraction}`} ${zone || '(offset not recorded)'}`,
    fraction, offset: zone || null,
  };
}

function coordinate(parts, reference, axis) {
  const ref = clean(reference).toUpperCase();
  if (!Array.isArray(parts) || parts.length !== 3 || !parts.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const [degrees, minutes, seconds] = parts;
  if (degrees < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
  if (!(axis === 'lat' ? ['N', 'S'] : ['E', 'W']).includes(ref)) return null;
  const magnitude = degrees + minutes / 60 + seconds / 3600;
  if (magnitude > (axis === 'lat' ? 90 : 180)) return null;
  return magnitude * (ref === 'S' || ref === 'W' ? -1 : 1);
}

export function normalizeCapture(raw = {}, status = 'read') {
  const latitude = coordinate(raw.GPSLatitude, raw.GPSLatitudeRef, 'lat');
  const longitude = coordinate(raw.GPSLongitude, raw.GPSLongitudeRef, 'lon');
  const make = clean(raw.Make);
  const model = clean(raw.Model);
  return {
    status,
    time: parseCaptureTime(raw.DateTimeOriginal, raw.SubSecTimeOriginal, raw.OffsetTimeOriginal),
    camera: model ? (model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ')) : make,
    serial: serial(raw.BodySerialNumber ?? raw.SerialNumber),
    gps: latitude === null || longitude === null ? null : { latitude, longitude, display: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` },
  };
}

function evidenceField(items, label, getValue, caseSensitive = false) {
  const counts = new Map();
  let present = 0;
  for (const item of items) {
    const value = getValue(item.capture);
    if (value === null || value === undefined || value === '') continue;
    const normalized = caseSensitive ? String(value).trim() : String(value).trim().toLowerCase();
    const existing = counts.get(normalized);
    if (existing) existing.count++;
    else counts.set(normalized, { value: String(value), count: 1 });
    present++;
  }
  const missing = items.length - present;
  const state = counts.size > 1 ? 'conflict' : present > 1 ? 'support' : 'unknown';
  const description = counts.size > 1 ? `${counts.size} different values recorded`
    : present > 1 ? `Same in ${present} files` : present ? 'Recorded in only one file' : 'Not recorded';
  return { label, state, description, missing, values: [...counts.values()] };
}

// Direct buckets only: no pairwise graph, transitive merging, or invented root.
// Exact duplicates alone never create a possibly-related group.
export function groupRelated(records) {
  const buckets = new Map();
  for (const item of records) {
    if (!item.hash || !item.size || item.error || !item.capture?.time) continue;
    const key = item.capture.time.key;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const groups = [];
  for (const [key, items] of buckets) {
    const byContent = new Map();
    for (const item of items) byContent.set(`${item.size}:${item.hash}`, item);
    const contentKeys = [...byContent.keys()].sort();
    if (contentKeys.length < 2) continue;
    // Assess independent file contents, so ten copies of one file cannot make
    // a clue look more complete or better supported than it really is.
    const representatives = [...byContent.values()];
    const evidence = [
      evidenceField(representatives, 'Fractional seconds', (c) => c?.time?.fraction),
      evidenceField(representatives, 'Camera model', (c) => c?.camera),
      evidenceField(representatives, 'Camera serial number', (c) => c?.serial, true),
      evidenceField(representatives, 'GPS coordinates', (c) => c?.gps?.display),
    ];
    const warnings = [];
    if (evidence[0].missing) warnings.push('Some capture times have only whole seconds. Separate burst shots can share this time.');
    if (evidence[0].state === 'conflict') warnings.push('Fractional capture times differ. These may be separate shots in a burst.');
    if (evidence[1].state === 'conflict' || evidence[2].state === 'conflict') warnings.push('Camera details conflict. These may be photographs from different devices.');
    if (evidence[3].state === 'conflict') warnings.push('Recorded GPS coordinates differ. Compare the values before treating these as related.');
    if (items[0].capture.time.offset === null) warnings.push('No time-zone offset is recorded. This group compares camera clock readings, not a verified instant.');
    groups.push({ id: `related:${key}`, kind: 'related', items, contentKeys, distinctContents: contentKeys.length,
      captureLabel: items[0].capture.time.label, evidence, warnings,
      hasConflicts: evidence.some((field) => field.state === 'conflict'),
      timeOnly: !evidence.some((field) => field.state === 'support'),
    });
  }
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

export function relationshipCoverage(records) {
  const eligible = records.filter((item) => item.capture?.time).length;
  const unavailable = records.filter((item) => item.capture?.status === 'unavailable').length;
  return { eligible, missingTime: records.length - eligible - unavailable, unavailable };
}

export function createRelatedReport(groups, reviews = {}) {
  const rows = [['Group', 'Relationship', 'Your assessment', 'Capture bucket', 'Different file contents', 'Evidence', 'Cautions', 'Folder label', 'Relative path', 'File name', 'Bytes', 'SHA-256', 'Recorded capture time', 'Camera model', 'Camera serial number', 'GPS coordinates']];
  const assessments = { related: 'Looks related', different: 'Different photographs', unsure: 'Not sure' };
  for (const [index, group] of groups.entries()) {
    const evidence = group.evidence.map((field) => `${field.label}: ${field.description}; ${field.missing} not recorded; ${field.values.map((v) => v.value).join(' / ')}`).join(' | ');
    for (const item of group.items) rows.push([index + 1, 'Possibly related — not confirmed', assessments[reviews[group.id]] || 'Not reviewed', group.captureLabel, group.distinctContents, evidence, group.warnings.join(' | '), item.folderName, item.path, item.name, item.size, item.hash, item.capture.time?.display, item.capture.camera, item.capture.serial, item.capture.gps?.display]);
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
