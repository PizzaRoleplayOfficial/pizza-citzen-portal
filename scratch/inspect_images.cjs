const sharp = require('sharp');

async function check() {
  const source = await sharp('pizza_icon_default_transparent.png').metadata();
  console.log('Source metadata:', source);

  const generatedRegular = await sharp('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png').metadata();
  console.log('Generated xxxhdpi ic_launcher metadata:', generatedRegular);

  const generatedForeground = await sharp('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png').metadata();
  console.log('Generated xxxhdpi ic_launcher_foreground metadata:', generatedForeground);
}

check().catch(console.error);
