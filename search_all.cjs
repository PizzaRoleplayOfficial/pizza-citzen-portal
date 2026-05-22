const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          console.log(`${fullPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  });
}

const query = process.argv[2] || 'temp';
console.log(`Searching all .ts and .tsx files in src/ for: ${query}`);
searchDir('./src', query);
