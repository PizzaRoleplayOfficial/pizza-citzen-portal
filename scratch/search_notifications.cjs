const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Searching for notification keywords in App.tsx...');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('/api/notifications') || line.toLowerCase().includes('fetchnotifications')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
