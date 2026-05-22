const sharp = require('sharp');
const fs = require('fs');

async function main() {
  // Copy original as-is to public (high quality)
  fs.copyFileSync('IMG_1307.png', 'public/pizza.png');

  // Generate 180x180 apple-touch-icon with white background
  await sharp('IMG_1307.png')
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile('public/apple-touch-icon.png');

  console.log('Done');
}

main().catch(console.error);
