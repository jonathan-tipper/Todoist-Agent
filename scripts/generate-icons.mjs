import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const source = join(root, 'public', 'logo.svg');

const sizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

// Generate standard icons
for (const { size, name } of sizes) {
  await sharp(source, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, name));
  console.log(`Generated ${name} (${size}x${size})`);
}

// Generate maskable icons (with padding for safe zone - 80% inner area)
const maskableSizes = [
  { size: 192, name: 'icon-maskable-192x192.png' },
  { size: 512, name: 'icon-maskable-512x512.png' },
];

for (const { size, name } of maskableSizes) {
  const iconSize = Math.round(size * 0.7); // Icon takes 70% of canvas, rest is safe-zone padding
  const padding = Math.round((size - iconSize) / 2);

  const icon = await sharp(source, { density: 300 })
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 255 }, // #0a0a0a dark background
    }
  })
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(join(outDir, name));

  console.log(`Generated ${name} (${size}x${size}, maskable)`);
}

console.log('\nAll icons generated successfully!');
