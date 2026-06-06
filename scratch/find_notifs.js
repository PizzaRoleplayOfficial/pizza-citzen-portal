const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log("Searching for notifications in App.tsx:");
lines.forEach((line, index) => {
  if (line.includes('notifications') || line.includes('Notification') || line.includes('unread')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
