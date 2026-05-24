const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const sourceIcon = 'pizza_icon_default_transparent_large.png';

const sizes = [
  { name: 'mipmap-mdpi', size: 48, adaptive: 108 },
  { name: 'mipmap-hdpi', size: 72, adaptive: 162 },
  { name: 'mipmap-xhdpi', size: 96, adaptive: 216 },
  { name: 'mipmap-xxhdpi', size: 144, adaptive: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, adaptive: 432 }
];

async function main() {
  if (!fs.existsSync(sourceIcon)) {
    console.error(`Source icon ${sourceIcon} not found!`);
    return;
  }

  // Update Web icons too
  fs.copyFileSync(sourceIcon, 'public/pizza.png');
  await sharp(sourceIcon)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile('public/apple-touch-icon.png');

  // Also update Web webp logo
  await sharp(sourceIcon)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp()
    .toFile('public/pizza.webp');

  console.log('Web icons updated (including webp).');

  // Generate Android launcher icons
  for (const s of sizes) {
    const targetDir = path.join(resDir, s.name);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const regularPath = path.join(targetDir, 'ic_launcher.png');
    const roundPath = path.join(targetDir, 'ic_launcher_round.png');
    const foregroundPath = path.join(targetDir, 'ic_launcher_foreground.png');

    // Regular Launcher Icon (transparent background)
    await sharp(sourceIcon)
      .resize(s.size, s.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(regularPath);

    // Round Launcher Icon (transparent background)
    await sharp(sourceIcon)
      .resize(s.size, s.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(roundPath);

    // Adaptive Foreground Icon: 108dp canvas with safe zone (approx. 66% of canvas size)
    const innerSize = Math.round(s.adaptive * 0.66);
    const padding = Math.round((s.adaptive - innerSize) / 2);
    
    await sharp(sourceIcon)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: padding,
        bottom: s.adaptive - innerSize - padding,
        left: padding,
        right: s.adaptive - innerSize - padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(foregroundPath);

    console.log(`Generated icons for ${s.name}: Regular/Round (${s.size}x${s.size}), Adaptive Foreground (${s.adaptive}x${s.adaptive})`);
  }

  // Remove the old unused vector drawable if it exists to prevent conflict
  const oldVectorForeground = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(oldVectorForeground)) {
    fs.unlinkSync(oldVectorForeground);
    console.log('Removed obsolete drawable-v24/ic_launcher_foreground.xml to prevent build system conflicts.');
  }

  console.log('Android launcher icons generation completed successfully.');
}

main().catch(console.error);
