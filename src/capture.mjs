import exifr from 'exifr';
import { normalizeCapture } from './relationships.mjs';
import { readAppleBurst } from './bursts.mjs';

// exifr calls EXIF BodySerialNumber (0xa431) "SerialNumber".
const fields = ['DateTimeOriginal', 'SubSecTimeOriginal', 'OffsetTimeOriginal', 'Make', 'Model', 'SerialNumber', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'];

export async function readCapture(file) {
  let buffer;
  try {
    // A bounded metadata read. Some formats keep metadata elsewhere; those files
    // remain eligible for exact matching, with relationship coverage explained.
    buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
  } catch {
    return { ...normalizeCapture({}, 'unavailable'), burst: { status: 'unavailable', uuid: null, source: null } };
  }
  let capture;
  try {
    const raw = await exifr.parse(buffer, { pick: fields, reviveValues: false, translateValues: false, silentErrors: false });
    capture = normalizeCapture(raw || {});
  } catch {
    capture = normalizeCapture({}, 'unavailable');
  }
  // Keep vendor-note failures independent of ordinary capture evidence. Never
  // retain the potentially large raw MakerNote in scan results or exports.
  try {
    const raw = await exifr.parse(buffer, { pick: ['MakerNote'], makerNote: true, silentErrors: false });
    return { ...capture, burst: readAppleBurst(raw?.makerNote) };
  } catch {
    return { ...capture, burst: { status: 'unavailable', uuid: null, source: null } };
  }
}
