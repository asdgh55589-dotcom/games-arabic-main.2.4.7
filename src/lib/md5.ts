/**
 * Pure MD5 (RFC 1321, table-driven reference structure) over bytes —
 * dependency-free so the browser chunk uploader can hash 5MB parts
 * client-side (SubtleCrypto has no MD5) and jest can verify it without
 * network. Validated against RFC vectors in
 * src/__tests__/ia-multipart.test.ts. Server re-verifies with node:crypto
 * (authoritative) — this copy is transport convenience, not trust.
 */

const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32))

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

function rol(x: number, s: number): number {
  return ((x << s) | (x >>> (32 - s))) | 0
}

function md5Words(input: Uint8Array): [number, number, number, number] {
  // Padding: 0x80, zeros, 64-bit LE bit-length (chunks here are ≤5MB).
  const bitLen = input.length * 8
  const paddedLen = (((input.length + 8) >> 6) + 1) << 6
  const msg = new Uint8Array(paddedLen)
  msg.set(input)
  msg[input.length] = 0x80
  const dv = new DataView(msg.buffer)
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true)
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 2 ** 32), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const M = new Array<number>(16)
  for (let off = 0; off < paddedLen; off += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(off + j * 4, true)
    }
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) | 0
      A = D
      D = C
      C = B
      B = (B + rol(F, S[i])) | 0
    }
    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }
  return [a0, b0, c0, d0]
}

/** MD5 hex digest of raw bytes. */
export function md5Hex(bytes: Uint8Array): string {
  const words = md5Words(bytes)
  let out = ''
  for (const w of words) {
    const u = w >>> 0
    for (let j = 0; j < 4; j++) {
      out += ((u >>> (j * 8)) & 0xff).toString(16).padStart(2, '0')
    }
  }
  return out
}
