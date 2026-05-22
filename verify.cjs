const s = require('fs').readFileSync('src/App.tsx', 'utf8');
console.log('is_temp_registration:', s.includes('is_temp_registration'));
console.log('registrationMode state:', s.includes("useState<'normal' | 'temp'>"));
console.log('temp UI:', s.includes('仮ナンバー申請として送信'));
console.log('Total lines:', s.split('\n').length);
