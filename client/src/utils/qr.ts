/**
 * Zero-dependency SVG QR Code Generator
 * Generates standards-compliant QR Code matrix (Version 1-10) with byte encoding and Error Correction Level M/L
 */

// Polynomial arithmetic for Reed-Solomon Error Correction
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}
EXP_TABLE[255] = EXP_TABLE[0];

function glog(n: number) {
  if (n < 1) throw new Error(`glog(${n})`);
  return LOG_TABLE[n];
}
function gexp(n: number) {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

class Polynomial {
  num: Uint8Array;
  constructor(num: Uint8Array) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Uint8Array(num.length - offset);
    for (let i = 0; i < this.num.length; i++) this.num[i] = num[offset + i];
  }
  multiply(e: Polynomial): Polynomial {
    const num = new Uint8Array(this.num.length + e.num.length - 1);
    for (let i = 0; i < this.num.length; i++) {
      for (let j = 0; j < e.num.length; j++) {
        num[i + j] ^= gexp(glog(this.num[i]) + glog(e.num[j]));
      }
    }
    return new Polynomial(num);
  }
  mod(e: Polynomial): Polynomial {
    if (this.num.length - e.num.length < 0) return this;
    const ratio = glog(this.num[0]) - glog(e.num[0]);
    const num = new Uint8Array(this.num.length);
    for (let i = 0; i < this.num.length; i++) num[i] = this.num[i];
    for (let i = 0; i < e.num.length; i++) {
      num[i] ^= gexp(glog(e.num[i]) + ratio);
    }
    return new Polynomial(num).mod(e);
  }
}

function getErrorCorrectionPolynomial(ecLength: number): Polynomial {
  let e = new Polynomial(new Uint8Array([1]));
  for (let i = 0; i < ecLength; i++) {
    e = e.multiply(new Polynomial(new Uint8Array([1, gexp(i)])));
  }
  return e;
}

// QR Code Specifications Table (Version 1-10, EC Level L / M)
// [totalCodewords, dataCodewords, ecCodewordsPerBlock, numBlocks]
const RS_BLOCK_TABLE: { [version: number]: [number, number, number, number] } = {
  1: [26, 16, 10, 1],
  2: [44, 28, 16, 1],
  3: [70, 44, 26, 1],
  4: [100, 64, 18, 2],
  5: [134, 86, 24, 2],
  6: [172, 108, 16, 4],
  7: [196, 124, 18, 4],
  8: [242, 154, 22, 4],
  9: [292, 182, 22, 5],
  10: [346, 216, 26, 5]
};

// Alignment pattern centers for versions 1 to 10
const ALIGNMENT_PATTERNS: { [version: number]: number[] } = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
};

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  
  // Pick smallest fitting version
  let version = 1;
  while (version <= 10) {
    const capacity = RS_BLOCK_TABLE[version][1] - 3; // header overhead
    if (bytes.length <= capacity) break;
    version++;
  }
  if (version > 10) version = 10;

  const [totalCodewords, dataCodewords, ecCodewords, numBlocks] = RS_BLOCK_TABLE[version];

  // Bit Buffer building (Byte mode: 0100)
  const bitBuffer: number[] = [];
  const putBits = (val: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  };

  putBits(4, 4); // Byte mode indicator
  putBits(bytes.length, version < 10 ? 8 : 16); // Character count
  for (const b of bytes) {
    putBits(b, 8);
  }

  // Terminator
  const totalDataBits = dataCodewords * 8;
  const paddingLength = Math.min(4, totalDataBits - bitBuffer.length);
  for (let i = 0; i < paddingLength; i++) bitBuffer.push(0);

  // Align to byte
  while (bitBuffer.length % 8 !== 0) bitBuffer.push(0);

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < totalDataBits) {
    putBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bit buffer to data codewords
  const dataBytes = new Uint8Array(dataCodewords);
  for (let i = 0; i < dataCodewords; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitBuffer[i * 8 + j];
    }
    dataBytes[i] = b;
  }

  // Divide into blocks and compute Reed-Solomon EC
  const blockSize = Math.floor(dataCodewords / numBlocks);
  const ecPoly = getErrorCorrectionPolynomial(ecCodewords);

  const blockData: Uint8Array[] = [];
  const blockEc: Uint8Array[] = [];

  for (let b = 0; b < numBlocks; b++) {
    const start = b * blockSize;
    const raw = dataBytes.slice(start, start + blockSize);
    blockData.push(raw);

    const rsPoly = new Polynomial(new Uint8Array([...raw, ...new Array(ecCodewords).fill(0)]));
    const mod = rsPoly.mod(ecPoly);
    const ecArr = new Uint8Array(ecCodewords);
    const modOffset = ecCodewords - mod.num.length;
    for (let i = 0; i < mod.num.length; i++) {
      ecArr[modOffset + i] = mod.num[i];
    }
    blockEc.push(ecArr);
  }

  // Interleave data and EC bytes
  const finalCodewords: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(blockData[b][i]);
    }
  }
  for (let i = 0; i < ecCodewords; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(blockEc[b][i]);
    }
  }

  // Module Grid initialization
  const size = version * 4 + 17;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Finder patterns
  const setupFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const tr = row + r;
        const tc = col + c;
        if (tr < 0 || tr >= size || tc < 0 || tc >= size) continue;
        if (r >= 0 && r <= 6 && (c === 0 || c === 6 || ((r === 0 || r === 6) && c >= 0 && c <= 6))) {
          modules[tr][tc] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          modules[tr][tc] = true;
        } else {
          modules[tr][tc] = false;
        }
      }
    }
  };
  setupFinder(0, 0);
  setupFinder(0, size - 7);
  setupFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
    if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_PATTERNS[version] || [];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if (modules[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          modules[r + dr][c + dc] = isBlack;
        }
      }
    }
  }

  // Dark module
  modules[size - 8][8] = true;

  // Format info area reservation
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (modules[8][i] === null) modules[8][i] = false;
    if (modules[i][8] === null) modules[i][8] = false;
  }

  // Populate data bits
  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((cw >> i) & 1);
    }
  }

  let bitIdx = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing column

    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let x = right; x >= right - 1; x--) {
        if (modules[y][x] === null) {
          const val = bitIdx < finalBits.length ? finalBits[bitIdx++] === 1 : false;
          // Apply standard Mask 0: (row + column) % 2 === 0
          const mask = (y + x) % 2 === 0;
          modules[y][x] = mask ? !val : val;
        }
      }
    }
    upward = !upward;
  }

  // Standard Format bits for EC Level M (00) and Mask 0 (000) => with BCH error correction and XOR 0x5412
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) modules[8][i] = formatBits[i] === 1;
  modules[8][7] = formatBits[6] === 1;
  modules[8][8] = formatBits[7] === 1;
  modules[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) modules[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) modules[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) modules[8][size - 15 + i] = formatBits[i] === 1;

  return modules as boolean[][];
}

/**
 * Returns clean SVG string of the QR code
 */
export function generateQrSvg(text: string, size = 160, color = '#06b6d4', bgColor = 'transparent'): string {
  const matrix = generateQrMatrix(text);
  const count = matrix.length;
  const cellSize = size / count;

  let paths = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = (cellSize + 0.1).toFixed(2);
        paths += `M${x},${y}h${w}v${w}h-${w}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    ${bgColor !== 'transparent' ? `<rect width="${size}" height="${size}" fill="${bgColor}"/>` : ''}
    <path d="${paths}" fill="${color}"/>
  </svg>`;
}
