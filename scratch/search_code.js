const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'views', 'TimelineView.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const query = process.argv[2] || '';
console.log(`Searching for "${query}" in ${filePath}...`);

let matchCount = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    matchCount++;
    console.log(`${index + 1}: ${line.trim()}`);
  }
});

console.log(`Found ${matchCount} matches.`);
