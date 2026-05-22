const sharp = require('sharp');

async function main() {
  const image = sharp('pizza_icon_default_transparent.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  
  let rSum = 0, gSum = 0, bSum = 0, aCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];
    
    if (a > 50) { // check non-transparent pixels
      rSum += r;
      gSum += g;
      bSum += b;
      aCount++;
    }
  }
  
  if (aCount > 0) {
    console.log(`Non-transparent pixels count: ${aCount}`);
    console.log(`Average non-transparent pixel color: R=${Math.round(rSum/aCount)}, G=${Math.round(gSum/aCount)}, B=${Math.round(bSum/aCount)}`);
  } else {
    console.log('No non-transparent pixels found!');
  }
}

main().catch(console.error);
