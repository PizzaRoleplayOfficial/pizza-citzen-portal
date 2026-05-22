const fs = require('fs');
const filePath = 'src/App.tsx';

// Read as buffer to detect encoding
const buf = fs.readFileSync(filePath);
const content = buf.toString('utf8');

// The two target strings (exact content as it is)
const oldEmoji = `              <span style={{ fontSize: '24px', lineHeight: 1 }}>\uD83C\uDF55</span>`;
const newEmoji = `              <span style={{ fontSize: '24px', lineHeight: 1 }}>{view === 'admin' ? '\uD83D\uDEE1\uFE0F' : '\uD83C\uDF55'}</span>`;

const oldTitle = `              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>\u3074\u3063\u3056\u3041\u30DD\u30FC\u30BF\u30EB</span>`;
const newTitle = `              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{view === 'admin' ? '\u904B\u55B6\u30D1\u30CD\u30EB' : '\u3074\u3063\u3056\u3041\u30DD\u30FC\u30BF\u30EB'}</span>`;

let updated = content;

if (updated.includes(oldEmoji)) {
  updated = updated.replace(oldEmoji, newEmoji);
  console.log('Emoji line replaced');
} else {
  console.log('ERROR: Emoji line not found');
  console.log('Looking for pizza...');
  const idx = updated.indexOf('\uD83C\uDF55');
  console.log('Pizza emoji at index:', idx);
  console.log('Context:', JSON.stringify(updated.substring(idx - 60, idx + 30)));
}

if (updated.includes(oldTitle)) {
  updated = updated.replace(oldTitle, newTitle);
  console.log('Title line replaced');
} else {
  console.log('ERROR: Title line not found');
}

// Write back with same encoding
fs.writeFileSync(filePath, updated, 'utf8');
console.log('Done');
