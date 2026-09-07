import type { Photo } from './types';

// Share one small preview across identical copies and serialize decodes. Neither
// thumbnails nor original bytes are persisted after their views are released.
interface Preview { refs: number; cancelled: boolean; ready: Promise<string>; url?: string }
const previews = new Map<string, Preview>();
let queue: Promise<unknown> = Promise.resolve();

export function acquirePreview(photo: Photo) {
  const key = photo.hash || photo.id;
  let entry = previews.get(key);
  if (!entry) {
    entry = { refs: 0, cancelled: false, ready: Promise.resolve('') };
    const current = entry;
    current.ready = queue.then(async () => {
      if (current.cancelled) return '';
      let blob: Blob = photo.file;
      if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
        let bitmap: ImageBitmap | undefined;
        try {
          bitmap = await createImageBitmap(photo.file, { resizeWidth: 960, resizeQuality: 'high' });
          const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
          const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
          const context = canvas.getContext('2d');
          if (context) {
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
          }
        } catch { /* Native <img> remains a useful fallback for supported formats. */ }
        finally { bitmap?.close(); }
      }
      if (current.cancelled) return '';
      current.url = URL.createObjectURL(blob);
      return current.url;
    });
    queue = current.ready.catch(() => {});
    previews.set(key, current);
  }
  entry.refs++;
  const current = entry;
  return { ready: current.ready, release: () => {
    current.refs--;
    if (current.refs === 0) {
      current.cancelled = true;
      if (current.url) URL.revokeObjectURL(current.url);
      previews.delete(key);
    }
  } };
}
