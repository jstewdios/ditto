import exifr from 'exifr';
import { normalizeCapture } from './relationships.mjs';

// exifr calls EXIF BodySerialNumber (0xa431) "SerialNumber".
const fields = ['DateTimeOriginal', 'SubSecTimeOriginal', 'OffsetTimeOriginal', 'Make', 'Model', 'SerialNumber', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'];

export async function readCapture(file) {
  try {
    // A bounded metadata read. Some formats keep metadata elsewhere; those files
    // remain eligible for exact matching, with relationship coverage explained.
    const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
    const raw = await exifr.parse(buffer, { pick: fields, reviveValues: false, translateValues: false, silentErrors: false });
    return normalizeCapture(raw || {});
  } catch {
    return normalizeCapture({}, 'unavailable');
  }
}
