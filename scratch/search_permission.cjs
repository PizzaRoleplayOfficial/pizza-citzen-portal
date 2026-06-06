const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Searching for requestNotificationPermission...');

lines.forEach((line, index) => {
  if (line.includes('requestNotificationPermission')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
