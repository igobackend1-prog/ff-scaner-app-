// Generates placeholder PNG assets for Expo
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  function byte4(n) {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  }
  function crc32(buf) {
    let c = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let n = i;
      for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
      table[i] = n;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type);
    const d = Buffer.from(data);
    const len = Buffer.from(byte4(d.length));
    const crcBuf = Buffer.concat([t, d]);
    const crc = Buffer.from(byte4(crc32(crcBuf)));
    return Buffer.concat([len, t, d, crc]);
  }

  // IHDR
  const ihdrData = [...byte4(width), ...byte4(height), 8, 2, 0, 0, 0];
  const ihdr = chunk('IHDR', ihdrData);

  // Raw pixel data: each row is filter_byte(0) + RGB * width
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', []);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, ihdr, idat, iend]);
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
if (!fs.existsSync(path.join(assetsDir, 'images')))
  fs.mkdirSync(path.join(assetsDir, 'images'), { recursive: true });

// Green FF icon (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPNG(1024, 1024, 22, 163, 74));
// Green splash (1284x2778)
fs.writeFileSync(path.join(assetsDir, 'splash.png'), createPNG(1284, 2778, 22, 163, 74));
// Adaptive icon (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createPNG(1024, 1024, 22, 163, 74));
// Favicon (32x32)
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), createPNG(32, 32, 22, 163, 74));

console.log('✅ All assets created in ./assets/');
