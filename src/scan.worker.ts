import { hashFile } from './core.mjs';
import { readCapture } from './capture.mjs';
import { groupRelated, relationshipCoverage } from './relationships.mjs';
import { groupBursts, burstCoverage } from './bursts.mjs';
import type { Photo } from './types';

self.onmessage = async ({ data }: MessageEvent<{ photos: Photo[] }>) => {
  const photos = data.photos;
  const totalBytes = photos.reduce((sum, photo) => sum + photo.size, 0);
  let bytes = 0;
  let completed = 0;
  let lastSent = 0;
  const records = [];
  const errors = [];
  const metadata = new Map();
  for (const photo of photos) {
    const startBytes = bytes;
    const report = (force = false) => {
      if (force || performance.now() - lastSent > 100) {
        self.postMessage({ type: 'progress', completed, total: photos.length, bytes, totalBytes, name: photo.path });
        lastSent = performance.now();
      }
    };
    try {
      if (photo.size === 0) throw new Error('Empty file; no photo content to compare.');
      const hash = await hashFile(photo.file, (count: number) => { bytes += count; report(); });
      if (!metadata.has(hash)) metadata.set(hash, await readCapture(photo.file));
      // Files already live in the UI; return only the small scan result.
      records.push({ id: photo.id, size: photo.size, hash, capture: metadata.get(hash) });
    } catch {
      errors.push({ id: photo.id, path: photo.path, error: photo.size === 0 ? 'Empty file' : 'Could not read file' });
      bytes = startBytes + photo.size;
    }
    completed++;
    report(completed === photos.length);
  }
  const related = groupRelated(records).map((group) => ({ ...group, items: group.items.map((item: { id: string }) => item.id) }));
  const bursts = groupBursts(records).map((group) => ({ ...group, items: group.items.map((item: { id: string }) => item.id) }));
  self.postMessage({ type: 'done', records, errors, related, coverage: relationshipCoverage(records), bursts, burstCoverage: burstCoverage(records) });
};
