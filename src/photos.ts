import exifr from 'exifr';
import { isPhoto } from './core.mjs';
import { readDimensions } from './dimensions.mjs';
import type { Folder, Photo } from './types';

export async function makeFolder(name: string, entries: { file: File; path: string }[]): Promise<Folder> {
  const id = crypto.randomUUID();
  const photos: Photo[] = [];
  for (const entry of entries) {
    if (!isPhoto(entry.file)) continue;
    photos.push({ id: crypto.randomUUID(), folderId: id, folderName: name, name: entry.file.name,
      path: entry.path, size: entry.file.size, lastModified: entry.file.lastModified, file: entry.file });
  }
  // A selection signature avoids accidentally counting the same selection twice.
  // It is not used to declare photos identical; only full content hashes do that.
  const manifest = JSON.stringify(entries.map(({ file, path }) => [path, file.size, file.lastModified]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(manifest));
  const signature = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { id, name, photos, skipped: entries.length - photos.length, signature };
}

export interface Details { taken?: string; camera?: string; width?: number; height?: number; orientation?: string; status: 'read' | 'unavailable' }
const cache = new Map<string, Promise<Details>>();
export function clearMetadataCache() { cache.clear(); }
export function photoDetails(photo: Photo): Promise<Details> {
  const key = photo.hash || photo.id;
  if (cache.has(key)) return cache.get(key)!;
  const promise: Promise<Details> = exifr.parse(photo.file, {
    reviveValues: false, gps: false, jfif: true, ihdr: true,
    pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'Make', 'Model', 'ExifImageWidth', 'ExifImageHeight', 'ImageWidth', 'ImageHeight', 'Orientation'],
  }).then((raw: Record<string, unknown> | undefined) => {
    const d = raw || {};
    const original = typeof d.DateTimeOriginal === 'string' ? d.DateTimeOriginal : '';
    const taken = original ? original.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') + (d.OffsetTimeOriginal ? ` ${d.OffsetTimeOriginal}` : ' (camera time)') : undefined;
    const make = typeof d.Make === 'string' ? d.Make.trim() : '';
    const model = typeof d.Model === 'string' ? d.Model.trim() : '';
    const camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ');
    return { taken, camera: camera || undefined, width: Number(d.ExifImageWidth || d.ImageWidth) || undefined,
      height: Number(d.ExifImageHeight || d.ImageHeight) || undefined, orientation: d.Orientation ? String(d.Orientation) : undefined, status: 'read' as const };
  }).catch(() => ({ status: 'unavailable' as const })).then(async (details: Details) => {
    try {
      const dimensions = readDimensions(await photo.file.slice(0, 1024 * 1024).arrayBuffer());
      // Header dimensions describe the stored image, without orientation changes.
      return { ...details, ...dimensions };
    } catch { return details; }
  });
  cache.set(key, promise);
  return promise;
}
