import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');
const appDir = join(root, 'src', 'app');

mkdirSync(outDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

const source = join(root, 'public', 'logo.svg');
const faviconPath = join(appDir, 'favicon.ico');
const appleIconPath = join(appDir, 'apple-icon.png');
const ogImagePath = join(appDir, 'opengraph-image.png');
const twitterImagePath = join(appDir, 'twitter-image.png');

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

await sharp(source, { density: 300 })
  .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(appleIconPath);
console.log('Generated apple-icon.png (180x180)');

const faviconPng = await sharp(source, { density: 300 })
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);
iconDir.writeUInt16LE(1, 2);
iconDir.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry.writeUInt8(64, 0);
entry.writeUInt8(64, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(faviconPng.length, 8);
entry.writeUInt32LE(22, 12);

writeFileSync(faviconPath, Buffer.concat([iconDir, entry, faviconPng]));
console.log('Generated favicon.ico');

async function createSocialImage(targetPath) {
  await sharp(source, { density: 300 })
    .resize(1200, 630, {
      fit: 'contain',
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    })
    .png()
    .toFile(targetPath);
}

await createSocialImage(ogImagePath);
console.log('Generated opengraph-image.png (1200x630)');

await createSocialImage(twitterImagePath);
console.log('Generated twitter-image.png (1200x630)');

console.log('\nAll brand assets generated successfully!');
