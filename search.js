const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const query = process.argv[2] || 'showBetaAutoFillModal';
console.log(`Searching for: ${query}`);

lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
