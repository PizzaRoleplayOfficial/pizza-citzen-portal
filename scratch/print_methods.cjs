const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

const printRange = (label, start, end) => {
  console.log(`\n=== ${label} ===`);
  for (let i = start - 1; i < end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
};

printRange("handleNotificationClick", 285, 335);
printRange("getNotificationIcon", 345, 385);
