import { hashFile } from './core.mjs';
import type { Photo } from './types';

self.onmessage = async ({ data }: MessageEvent<{ photos: Photo[] }>) => {
  const photos = data.photos;
  const totalBytes = photos.reduce((sum, photo) => sum + photo.size, 0);
  let bytes = 0;
  let completed = 0;
  let lastSent = 0;
  const records = [];
  const errors = [];
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
      // Files already live in the UI; return only the small scan result.
      records.push({ id: photo.id, hash });
    } catch {
      errors.push({ id: photo.id, path: photo.path, error: photo.size === 0 ? 'Empty file' : 'Could not read file' });
      bytes = startBytes + photo.size;
    }
    completed++;
    report(completed === photos.length);
  }
  self.postMessage({ type: 'done', records, errors });
};
