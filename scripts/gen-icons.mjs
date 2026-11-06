// Generates the pixel-art SVG icons in media/ from ASCII bitmaps ('#' = pixel).
//   media/lucky-break.svg      activity-bar icon (VS Code masks it, so only the shape matters)
//   media/lucky-break-tab.svg  editor-tab icon for the panel, in gold
//   media/icon.png        128x128 Marketplace icon: the die on Lucky Break felt, drawn pixel by pixel
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// A die showing five, with chamfered corners.
const DIE = [
  '.##########.',
  '############',
  '##..####..##',
  '##..####..##',
  '############',
  '#####..#####',
  '#####..#####',
  '############',
  '##..####..##',
  '##..####..##',
  '############',
  '.##########.',
];

const CELL = 2;
const PADDING = 2;

function toSvg(bitmap, fill) {
  const size = bitmap[0].length * CELL;
  const view = size + PADDING * 2;
  const rects = [];
  bitmap.forEach((row, y) => {
    // Merge horizontal runs so the file stays small and seams never appear between pixels.
    for (const run of row.matchAll(/#+/g)) {
      rects.push(
        `<rect x="${run.index * CELL}" y="${y * CELL}" width="${run[0].length * CELL}" height="${CELL}"/>`,
      );
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PADDING} ${-PADDING} ${view} ${view}" width="24" height="24" fill="${fill}" shape-rendering="crispEdges">\n  ${rects.join('\n  ')}\n</svg>\n`;
}

mkdirSync('media', { recursive: true });
writeFileSync('media/lucky-break.svg', toSvg(DIE, '#C5C5C5'));
writeFileSync('media/lucky-break-tab.svg', toSvg(DIE, '#F5C451'));

// ---------------------------------------------------------------- Marketplace icon (PNG)

const ICON_SIZE = 128;
const SCALE = 6; // each bitmap pixel is 6x6 real pixels, so the art stays crisp
const PALETTE = {
  felt: [0x17, 0x4d, 0x36],
  shade: [0x0f, 0x33, 0x24],
  gold: [0xf5, 0xc4, 0x51],
  die: [0xf2, 0xf0, 0xe8],
  pip: [0xe9, 0x4b, 0x4b],
};

function drawIcon() {
  const pixels = Buffer.alloc(ICON_SIZE * ICON_SIZE * 3);
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= ICON_SIZE || y >= ICON_SIZE) return;
    const at = (y * ICON_SIZE + x) * 3;
    pixels[at] = r;
    pixels[at + 1] = g;
    pixels[at + 2] = b;
  };
  const rect = (x, y, w, h, colour) => {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) put(x + i, y + j, colour);
  };

  rect(0, 0, ICON_SIZE, ICON_SIZE, PALETTE.felt);
  // A gold frame, notched at the corners like every panel in Lucky Break.
  const frame = 8;
  rect(frame + 8, frame, ICON_SIZE - 2 * (frame + 8), 8, PALETTE.gold);
  rect(frame + 8, ICON_SIZE - frame - 8, ICON_SIZE - 2 * (frame + 8), 8, PALETTE.gold);
  rect(frame, frame + 8, 8, ICON_SIZE - 2 * (frame + 8), PALETTE.gold);
  rect(ICON_SIZE - frame - 8, frame + 8, 8, ICON_SIZE - 2 * (frame + 8), PALETTE.gold);

  // The die, with a hard shadow to the lower right. The '.' cells inside the die are its pips; the
  // ones on the outer edge are the chamfered corners and show the felt.
  const last = DIE.length - 1;
  const isPip = (x, y) => DIE[y][x] === '.' && x > 0 && y > 0 && x < last && y < last;
  const shadow = SCALE;
  const origin = (ICON_SIZE - DIE.length * SCALE - shadow) / 2;
  DIE.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '#') rect(origin + shadow + x * SCALE, origin + shadow + y * SCALE, SCALE, SCALE, PALETTE.shade);
    });
  });
  DIE.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '#') rect(origin + x * SCALE, origin + y * SCALE, SCALE, SCALE, PALETTE.die);
      else if (isPip(x, y)) rect(origin + x * SCALE, origin + y * SCALE, SCALE, SCALE, PALETTE.pip);
    });
  });
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(ICON_SIZE, 0);
  header.writeUInt32BE(ICON_SIZE, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // truecolour (RGB)
  const rowLength = ICON_SIZE * 3;
  const raw = Buffer.alloc((rowLength + 1) * ICON_SIZE);
  for (let y = 0; y < ICON_SIZE; y += 1) {
    raw[y * (rowLength + 1)] = 0; // filter: none
    rgb.copy(raw, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('media/icon.png', toPng(drawIcon()));
console.log('Wrote media/lucky-break.svg, media/lucky-break-tab.svg and media/icon.png');
