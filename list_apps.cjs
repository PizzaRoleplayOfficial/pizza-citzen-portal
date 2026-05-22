const fs = require('fs');
const path = require('path');

const root = './';
const files = fs.readdirSync(root);

function findAppFiles(dir) {
  const list = [];
  function traverse(d) {
    const items = fs.readdirSync(d);
    items.forEach(item => {
      if (item === 'node_modules' || item === '.git' || item === '.wrangler') return;
      const full = path.join(d, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        traverse(full);
      } else if (item === 'App.tsx') {
        list.push({ path: full, size: stat.size, mtime: stat.mtime });
      }
    });
  }
  traverse(dir);
  return list;
}

const appFiles = findAppFiles(root);
appFiles.sort((a, b) => b.mtime - a.mtime);
console.log('App.tsx files in workspace ordered by mtime (newest first):');
appFiles.forEach(f => {
  console.log(`- Path: ${f.path}, Size: ${f.size} bytes, Mtime: ${f.mtime}`);
});
