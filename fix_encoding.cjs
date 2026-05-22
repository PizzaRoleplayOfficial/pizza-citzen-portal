const fs = require('fs');

// Fix files that were saved with wrong encoding by PowerShell
// The issue: PowerShell -replace then Set-Content corrupted UTF-8 Japanese text
// Solution: re-read as UTF-8 and replace only the ASCII pizza.webp string

const files = [
  { path: 'src/App.tsx', from: '/pizza.webp', to: '/pizza.png' },
  { path: 'src/views/LandingView.tsx', from: '/pizza.webp', to: '/pizza.png' },
];

for (const { path, from, to } of files) {
  // Read raw bytes and check if file is corrupted (non-UTF8)
  const raw = fs.readFileSync(path);
  // Try to decode as UTF-8
  const content = raw.toString('utf8');
  
  // Check if content looks garbled (contains replacement chars or sjis-like garbage)
  // If the file contains the Japanese text correctly, proceed
  if (content.includes(from)) {
    const fixed = content.split(from).join(to);
    fs.writeFileSync(path, fixed, 'utf8');
    console.log(`Fixed ${path}`);
  } else {
    console.log(`${path}: '${from}' not found - may already be replaced or corrupted`);
    // Check for pizza.png too
    if (content.includes('/pizza.png')) {
      console.log(`  -> already has /pizza.png`);
    }
  }
}

console.log('Done');
