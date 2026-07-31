import sharp from 'sharp';
import fs from 'fs';

// Fetch grid from API
const formData = new FormData();
const blob = new Blob([fs.readFileSync('/home/team/shared/IMG_6923.png')], { type: 'image/png' });
formData.append('image', blob, 'IMG_6923.png');
formData.append('gridSize', '200');
formData.append('maxColors', '6');

const res = await fetch('http://localhost:3001/api/ai/line-art-to-pattern', {
  method: 'POST',
  body: formData,
});
const d = await res.json();

const g = d.grid || d.gridData;
if (!g) {
  console.log('No grid in response. Keys:', Object.keys(d));
  process.exit(1);
}

const sz = g.length;
const SCALE = 4;
const buf = Buffer.alloc(sz * SCALE * sz * SCALE * 4);

const dmcHex = {};
(d.dmcColors || []).forEach((c) => { dmcHex[c.code] = c.hex; });

for (let r = 0; r < sz; r++) {
  for (let c = 0; c < sz; c++) {
    const cell = g[r][c];
    const hex = dmcHex[cell.dmcCode] || cell.color || '#FF00FF';
    const rr = parseInt(hex.slice(1, 3), 16);
    const gg = parseInt(hex.slice(3, 5), 16);
    const bb = parseInt(hex.slice(5, 7), 16);
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const i = ((r * SCALE + dy) * sz * SCALE + (c * SCALE + dx)) * 4;
        buf[i] = rr;
        buf[i + 1] = gg;
        buf[i + 2] = bb;
        buf[i + 3] = 255;
      }
    }
  }
}

await sharp(buf, { raw: { width: sz * SCALE, height: sz * SCALE, channels: 4 } })
  .png()
  .toFile('/home/team/shared/stocking-grid-result.png');

console.log('Saved /home/team/shared/stocking-grid-result.png');
console.log(JSON.stringify({ size: sz, colors: d.dmcColors?.length || 0 }));
