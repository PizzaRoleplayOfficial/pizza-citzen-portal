import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const srcPath = path.resolve('public/tesseract/langs/eng.traineddata');
const destPath = path.resolve('public/tesseract/langs/eng.traineddata.gz');

console.log(`Compressing ${srcPath} to ${destPath}...`);

if (!fs.existsSync(srcPath)) {
  console.error(`Source file not found at: ${srcPath}`);
  process.exit(1);
}

const fileContents = fs.readFileSync(srcPath);
zlib.gzip(fileContents, (err, compressed) => {
  if (err) {
    console.error('Error compressing file:', err);
    process.exit(1);
  }
  fs.writeFileSync(destPath, compressed);
  console.log('Success! compressed file size:', compressed.length, 'bytes');
});
