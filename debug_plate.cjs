const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Find the exact block (with \r\n line endings)
const oldBlock = `              <div>\r\n                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number</label>\r\n                 <input type="text" placeholder="例: ABC-1234" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, background: 'var(--input-bg)' }} />\r\n               </div>`;

console.log('Found old block:', content.includes(oldBlock));

// Try to find the lines more loosely
const idx = content.indexOf('License Plate Number</label>');
console.log('License Plate label idx:', idx);
if (idx > -1) {
  // Find the wrapping div start (go back ~10 chars looking for <div>)
  const divStart = content.lastIndexOf('<div>', idx);
  const divEnd = content.indexOf('</div>', idx) + 6;
  console.log('div start:', divStart, 'div end:', divEnd);
  console.log('Block to replace:', JSON.stringify(content.substring(divStart, divEnd).substring(0, 200)));
}
