const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');
const before = `<div onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>`;
const after = `<div onClick={() => view !== 'admin' && setView('home')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: view !== 'admin' ? 'pointer' : 'default' }}>`;
c = c.replace(before, after);
fs.writeFileSync('src/App.tsx', c);
console.log('done');
