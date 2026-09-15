import { inflateRawSync } from "node:zlib";

// Validate and bound ZIP expansion before SheetJS allocates XML strings/cells.
export function checkExcelContainer(bytes: Uint8Array): void {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = () => { throw new Error("Небезопасный или повреждённый ZIP-контейнер Excel."); };
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) { end = i; break; }
  }
  if (end < 0) return fail();
  const count = b.readUInt16LE(end + 10);
  const size = b.readUInt32LE(end + 12);
  let cursor = b.readUInt32LE(end + 16);
  if (b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6) || b.readUInt16LE(end + 8) !== count || !count || count > 1000 || cursor + size !== end) return fail();
  const directory = cursor;
  let total = 0;
  const ranges: [number, number][] = [];
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || b.readUInt32LE(cursor) !== 0x02014b50) return fail();
    const flags = b.readUInt16LE(cursor + 8), method = b.readUInt16LE(cursor + 10);
    const compressed = b.readUInt32LE(cursor + 20), expanded = b.readUInt32LE(cursor + 24);
    const nameLength = b.readUInt16LE(cursor + 28), extra = b.readUInt16LE(cursor + 30), comment = b.readUInt16LE(cursor + 32);
    const offset = b.readUInt32LE(cursor + 42);
    if (flags & 1 || ![0, 8].includes(method) || b.readUInt16LE(cursor + 34) || expanded > 16 * 1024 * 1024 || (total += expanded) > 64 * 1024 * 1024) return fail();
    if (cursor + 46 + nameLength + extra + comment > end || offset + 30 > directory || b.readUInt32LE(offset) !== 0x04034b50) return fail();
    const nameBytes = b.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString("utf8");
    if (!name || names.has(name) || name.includes("\0") || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..")) return fail();
    names.add(name);
    const localName = b.readUInt16LE(offset + 26), localExtra = b.readUInt16LE(offset + 28);
    const start = offset + 30 + localName + localExtra;
    if (start + compressed > directory || flags !== b.readUInt16LE(offset + 6) || method !== b.readUInt16LE(offset + 8) || !nameBytes.equals(b.subarray(offset + 30, offset + 30 + localName))) return fail();
    if (!(flags & 8) && (compressed !== b.readUInt32LE(offset + 18) || expanded !== b.readUInt32LE(offset + 22))) return fail();
    if (ranges.some(([a, z]) => offset < z && start + compressed > a)) return fail();
    ranges.push([offset, start + compressed]);
    const data = b.subarray(start, start + compressed);
    const actual = method === 0 ? data.length : inflateRawSync(data, { maxOutputLength: Math.max(1, expanded) }).length;
    if (actual !== expanded) return fail();
    cursor += 46 + nameLength + extra + comment;
  }
  if (cursor !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) return fail();
}
