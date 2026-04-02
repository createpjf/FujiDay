const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const manifest = require('./fujiday-v1-manifest.json');

function bucketColor(bucket) {
  const table = {
    portrait: { r: 195, g: 165, b: 155 },
    street: { r: 120, g: 130, b: 145 },
    travel: { r: 130, g: 165, b: 140 },
    night: { r: 60, g: 70, b: 115 },
    'high-contrast': { r: 185, g: 185, b: 145 },
    monochrome: { r: 150, g: 150, b: 150 },
    'mixed-light': { r: 165, g: 140, b: 125 },
    nostalgic: { r: 165, g: 140, b: 120 },
    people: { r: 190, g: 160, b: 150 },
    editorial: { r: 135, g: 140, b: 135 },
    quiet: { r: 145, g: 150, b: 155 },
    landscape: { r: 125, g: 160, b: 125 }
  };
  return table[bucket] || { r: 140, g: 140, b: 140 };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const fixturesDir = path.join(root, 'evals', 'fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });

  await Promise.all(manifest.map(async (item, index) => {
    const background = bucketColor(item.bucket);
    const outPath = path.join(root, item.fixture_path);
    const width = 960;
    const height = 640;
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgb(${background.r},${background.g},${background.b})" />
            <stop offset="100%" stop-color="rgb(${Math.max(0, background.r - 35)},${Math.max(0, background.g - 35)},${Math.max(0, background.b - 35)})" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
        <circle cx="${160 + (index % 5) * 120}" cy="${160 + (index % 4) * 70}" r="90" fill="rgba(255,255,255,0.15)" />
        <rect x="${100 + (index % 6) * 90}" y="${280 + (index % 3) * 40}" width="520" height="160" rx="28" fill="rgba(0,0,0,0.16)" />
        <text x="60" y="72" font-size="40" font-family="Helvetica" fill="rgba(255,255,255,0.9)">${item.id}</text>
        <text x="60" y="124" font-size="28" font-family="Helvetica" fill="rgba(255,255,255,0.78)">${item.bucket}</text>
      </svg>
    `;

    await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(outPath);
  }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
