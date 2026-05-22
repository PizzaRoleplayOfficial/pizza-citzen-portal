const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    // Only copy code/json/css files and icons, avoid temp files
    if (src.endsWith('.tsx') || src.endsWith('.ts') || src.endsWith('.json') || src.endsWith('.css') || src.endsWith('.png') || src.endsWith('.svg') || src.endsWith('.webp')) {
      console.log(`Copying: ${src} -> ${dest}`);
      fs.copyFileSync(src, dest);
    }
  }
}

console.log('Starting restore of latest files from backup_wiki_grade_fix...');
copyRecursive('backup_wiki_grade_fix/src', 'src');
copyRecursive('backup_wiki_grade_fix/functions', 'functions');
console.log('Restore completed successfully!');
