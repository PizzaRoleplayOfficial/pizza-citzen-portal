const fs = require('fs');
const path = require('path');

const targetFilePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(targetFilePath, 'utf8');

// Normalize CRLF to LF
content = content.replace(/\r\n/g, '\n');

// 1. Replace PC logo styling
const pcLogoTarget = `<img src="/pizza.webp" alt="Logo" style={{ width: '30px', height: '30px', marginRight: '8px', objectFit: 'contain' }} />`;
const pcLogoReplacement = `<img src="/pizza.webp" alt="Logo" style={{ width: '30px', height: '30px', marginRight: '8px', objectFit: 'cover', borderRadius: '50%' }} />`;

if (content.includes(pcLogoTarget)) {
  content = content.replace(pcLogoTarget, pcLogoReplacement);
  console.log('PC Logo styling updated to round');
} else {
  console.log('PC Logo styling target not found');
}

// 2. Replace Mobile logo styling
const mobileLogoTarget = `<img src="/pizza.webp" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />`;
const mobileLogoReplacement = `<img src="/pizza.webp" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '50%' }} />`;

if (content.includes(mobileLogoTarget)) {
  content = content.replace(mobileLogoTarget, mobileLogoReplacement);
  console.log('Mobile Logo styling updated to round');
} else {
  console.log('Mobile Logo styling target not found');
}

fs.writeFileSync(targetFilePath, content, 'utf8');
console.log('App.tsx updated.');
