/**
 * Gói bàn giao cho AI 3D (W2): đóng ZIP chứa hồ sơ thiết kế 2D của một
 * thực thể + bản mô tả tiếng Anh để đưa sang Meshy/Tripo sinh GLB.
 *
 * Không dùng thư viện ngoài (tránh thêm dependency cho một tính năng):
 * ZIP ghi theo phương pháp STORE (không nén) — file PNG vốn đã nén nên
 * không nén thêm cũng không thiệt bao nhiêu. CRC32 tính tay theo bảng.
 */

export interface HandoffFile {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): [number, number] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function u32(n: number): [number, number, number, number] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

/** Đóng gói các file thành bytes ZIP (STORE). Tên file encode UTF-8. */
export function buildZip(files: HandoffFile[]): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    // Local file header: PK\x03\x04
    chunks.push(0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0));
    chunks.push(...u16(0), ...u16(0), ...u32(crc), ...u32(f.data.length));
    chunks.push(...u32(f.data.length), ...u16(nameBytes.length), ...u16(0));
    chunks.push(...nameBytes, ...f.data);
    // Central directory: PK\x01\x02
    central.push(0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800));
    central.push(...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(f.data.length));
    central.push(...u32(f.data.length), ...u16(nameBytes.length));
    central.push(...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0));
    central.push(...u32(offset), ...nameBytes);
    offset += 30 + nameBytes.length + f.data.length;
  }
  const centralOffset = offset;
  const centralSize = central.length;
  // End of central directory: PK\x05\x06
  const eocd = [
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(centralOffset), ...u16(0),
  ];
  return new Uint8Array([...chunks, ...central, ...eocd]);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Soạn bản mô tả tiếng Anh cho AI 3D từ hồ sơ thực thể. */
export function handoffPromptText(entity: {
  name: string;
  role: string;
  traits: string[];
  description: string;
  customFields?: Array<{ key: string; value: string }>;
  palette?: string[];
}): string {
  const lines = [
    `Character / asset: ${entity.name}`,
    entity.role ? `Role: ${entity.role}` : "",
    entity.traits.length ? `Traits: ${entity.traits.join(", ")}` : "",
    entity.description ? `Description: ${entity.description}` : "",
    ...(entity.customFields ?? []).map((f) => `${f.key}: ${f.value}`),
    (entity.palette ?? []).length
      ? `Color palette (hex): ${(entity.palette ?? []).join(", ")}`
      : "",
    "",
    "Generate a game-ready low-poly 3D model (GLB, Y-up, meters, PBR",
    "metallic-roughness materials, under 50k triangles) matching the",
    "reference views in this package. Keep the silhouette readable and",
    "the palette consistent with the reference images.",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

/** Tải gói ZIP xuống máy người dùng. */
export function downloadHandoffZip(
  fileName: string,
  files: HandoffFile[],
): void {
  const blob = new Blob([buildZip(files) as BlobPart], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
