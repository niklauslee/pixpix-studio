/**
 * Minimal ZIP writer for browser downloads: every entry is stored (method 0,
 * no compression), which keeps the container to a few dozen lines and needs no
 * dependency. Fine for the small text bundles we generate (the icon editor's
 * React component export); don't reach for it with large binary payloads.
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. `"index.ts"`. */
  name: string;
  content: string;
}

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time pair, as ZIP headers store timestamps. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day =
    ((Math.max(date.getFullYear() - 1980, 0) & 0x7f) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, date: day };
}

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const EOCD_SIZE = 22;
// version 2.0 (the floor for the fields we write), UTF-8 filename flag
const VERSION = 20;
const FLAG_UTF8 = 0x0800;

/** Pack entries into an uncompressed `.zip` blob. */
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const files = entries.map((entry) => {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    return { name, data, crc: crc32(data), offset: 0 };
  });

  const localSize = files.reduce(
    (sum, file) =>
      sum + LOCAL_HEADER_SIZE + file.name.length + file.data.length,
    0,
  );
  const centralSize = files.reduce(
    (sum, file) => sum + CENTRAL_HEADER_SIZE + file.name.length,
    0,
  );

  const buffer = new Uint8Array(localSize + centralSize + EOCD_SIZE);
  const view = new DataView(buffer.buffer);
  const { time, date } = dosDateTime(new Date());
  let offset = 0;

  for (const file of files) {
    file.offset = offset;
    view.setUint32(offset, 0x04034b50, true); // local file header signature
    view.setUint16(offset + 4, VERSION, true);
    view.setUint16(offset + 6, FLAG_UTF8, true);
    view.setUint16(offset + 8, 0, true); // method: stored
    view.setUint16(offset + 10, time, true);
    view.setUint16(offset + 12, date, true);
    view.setUint32(offset + 14, file.crc, true);
    view.setUint32(offset + 18, file.data.length, true); // compressed size
    view.setUint32(offset + 22, file.data.length, true); // uncompressed size
    view.setUint16(offset + 26, file.name.length, true);
    view.setUint16(offset + 28, 0, true); // extra field length
    offset += LOCAL_HEADER_SIZE;
    buffer.set(file.name, offset);
    offset += file.name.length;
    buffer.set(file.data, offset);
    offset += file.data.length;
  }

  const centralStart = offset;
  for (const file of files) {
    view.setUint32(offset, 0x02014b50, true); // central directory signature
    view.setUint16(offset + 4, VERSION, true); // version made by
    view.setUint16(offset + 6, VERSION, true); // version needed
    view.setUint16(offset + 8, FLAG_UTF8, true);
    view.setUint16(offset + 10, 0, true); // method: stored
    view.setUint16(offset + 12, time, true);
    view.setUint16(offset + 14, date, true);
    view.setUint32(offset + 16, file.crc, true);
    view.setUint32(offset + 20, file.data.length, true);
    view.setUint32(offset + 24, file.data.length, true);
    view.setUint16(offset + 28, file.name.length, true);
    view.setUint16(offset + 30, 0, true); // extra field length
    view.setUint16(offset + 32, 0, true); // comment length
    view.setUint16(offset + 34, 0, true); // disk number start
    view.setUint16(offset + 36, 0, true); // internal attributes
    view.setUint32(offset + 38, 0, true); // external attributes
    view.setUint32(offset + 42, file.offset, true);
    offset += CENTRAL_HEADER_SIZE;
    buffer.set(file.name, offset);
    offset += file.name.length;
  }

  view.setUint32(offset, 0x06054b50, true); // end of central directory
  view.setUint16(offset + 4, 0, true); // disk number
  view.setUint16(offset + 6, 0, true); // disk with central directory
  view.setUint16(offset + 8, files.length, true);
  view.setUint16(offset + 10, files.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true); // comment length

  return new Blob([buffer], { type: "application/zip" });
}
