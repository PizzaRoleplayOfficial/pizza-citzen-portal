import Tesseract from 'tesseract.js';

const imagePath = 'latest_uploaded.png';

console.log('Starting OCR on:', imagePath);
try {
  const result = await Tesseract.recognize(imagePath, 'eng');
  console.log('--- OCR Result ---');
  console.log(result.data.text);
  console.log('------------------');
} catch (err) {
  console.error('Error during OCR:', err);
}
