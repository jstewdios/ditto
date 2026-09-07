// Read dimensions from common image headers without decoding full-size pixels.
// This is display metadata only; matching always hashes the entire original file.
export function readDimensions(buffer) {
  const data = new Uint8Array(buffer);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const text = (start, length) => String.fromCharCode(...data.subarray(start, start + length));
  const valid = (width, height) => width > 0 && height > 0 ? { width, height } : {};
  if (data.length >= 24 && data[0] === 137 && text(1, 3) === 'PNG' && text(12, 4) === 'IHDR')
    return valid(view.getUint32(16), view.getUint32(20));
  if (data.length >= 10 && (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a'))
    return valid(view.getUint16(6, true), view.getUint16(8, true));
  if (data.length >= 26 && text(0, 2) === 'BM') {
    const dib = view.getUint32(14, true);
    if (dib === 12) return valid(view.getUint16(18, true), view.getUint16(20, true));
    if (dib >= 40) return valid(view.getInt32(18, true), Math.abs(view.getInt32(22, true)));
  }
  if (data.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const kind = text(12, 4);
    if (kind === 'VP8X') return valid(1 + data[24] + (data[25] << 8) + (data[26] << 16), 1 + data[27] + (data[28] << 8) + (data[29] << 16));
    if (kind === 'VP8 ' && data[23] === 0x9d && data[24] === 1 && data[25] === 0x2a)
      return valid(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  if (data.length >= 25 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP' && text(12, 4) === 'VP8L' && data[20] === 0x2f)
    return valid(1 + data[21] + ((data[22] & 0x3f) << 8), 1 + (data[22] >> 6) + (data[23] << 2) + ((data[24] & 0xf) << 10));
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= data.length && data[offset] === 0xff) {
      while (data[offset] === 0xff) offset++;
      const marker = data[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.length) break;
      const length = view.getUint16(offset);
      if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7 && offset + 7 <= data.length)
        return valid(view.getUint16(offset + 5), view.getUint16(offset + 3));
      offset += length;
    }
  }
  return {};
}
