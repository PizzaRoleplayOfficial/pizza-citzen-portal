const fs = require('fs');

// ==== 1. Update functions/api/vehicles.ts ====
let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');

const target1 = `    if (action === 'issue_temp') {
      const tempPlate = \`T-\${String(Math.floor(Math.random() * 900000) + 100000)}\`;`;

const replacement1 = `    if (action === 'issue_temp') {
      const tempPlate = body.custom_plate && body.custom_plate.trim() !== '' 
        ? body.custom_plate.trim() 
        : \`T-\${String(Math.floor(Math.random() * 900000) + 100000)}\`;`;

if(api.includes(target1)) {
  api = api.replace(target1, replacement1);
} else {
  api = api.replace(/\r/g, '').replace(target1.replace(/\r/g, ''), replacement1.replace(/\r/g, ''));
}
fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');

// ==== 2. Update App.tsx ====
let app = fs.readFileSync('src/App.tsx', 'utf8');

const target2 = `const handleTempAction = async (id: string, action: 'issue_temp' | 'extend_temp' | 'revoke_temp', days?: number) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days })
      });`;

const replacement2 = `const handleTempAction = async (id: string, action: 'issue_temp' | 'extend_temp' | 'revoke_temp', days?: number, customPlate?: string) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days, custom_plate: customPlate })
      });`;

if(app.includes(target2)) {
  app = app.replace(target2, replacement2);
} else {
  app = app.replace(/\r/g, '').replace(target2.replace(/\r/g, ''), replacement2.replace(/\r/g, ''));
}

const target2b = `handleTempAction={handleTempAction}`;
// AdminDashboardView might need the updated signature if TypeScript checks it, but in the interface we didn't specify it yet.
// Wait, we used `handleTempAction?: (id: string, action: 'issue_temp'|'extend_temp'|'revoke_temp', days?: number) => void;` in AdminDashboardView Props.
// Let's replace the signature in AdminDashboardView.tsx instead.

fs.writeFileSync('src/App.tsx', app, 'utf8');

// ==== 3. Update AdminDashboardView.tsx ====
let views = fs.readFileSync('src/views/AdminDashboardView.tsx', 'utf8');

// Props
views = views.replace(
  `handleTempAction?: (id: string, action: 'issue_temp'|'extend_temp'|'revoke_temp', days?: number) => void;`,
  `handleTempAction?: (id: string, action: 'issue_temp'|'extend_temp'|'revoke_temp', days?: number, customPlate?: string) => void;`
);

// State
views = views.replace(
  `const [tempDialog, setTempDialog] = useState<{isOpen: boolean, vehicleId: string, action: 'issue_temp'|'extend_temp', days: number} | null>(null);`,
  `const [tempDialog, setTempDialog] = useState<{isOpen: boolean, vehicleId: string, action: 'issue_temp'|'extend_temp', days: number, customPlate?: string} | null>(null);`
);

// renderTempButtons 
const oldBtn = `setTempDialog({ isOpen: true, vehicleId: v.id, action: 'issue_temp', days: 7 });`;
const newBtn = `setTempDialog({ isOpen: true, vehicleId: v.id, action: 'issue_temp', days: 7, customPlate: '' });`;
views = views.split(oldBtn).join(newBtn);


// Dialog UI - Inject custom input
const dialogTarget = `<div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                <span>日数</span>`;

const dialogReplacement = `{tempDialog.action === 'issue_temp' && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                  <span>カスタムナンバー名称 (空欄で自動採番)</span>
                </div>
                <input 
                  type="text" 
                  value={tempDialog.customPlate || ''} 
                  onChange={(e) => setTempDialog({...tempDialog, customPlate: e.target.value})}
                  placeholder="例: T-89248"
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontWeight: 700 }}
                />
              </div>
            )}
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                <span>日数</span>`;

if(views.includes(dialogTarget)) {
  views = views.replace(dialogTarget, dialogReplacement);
} else {
  views = views.replace(/\r/g, '').replace(dialogTarget.replace(/\r/g, ''), dialogReplacement.replace(/\r/g, ''));
}


// Dialog submit button
views = views.replace(
  `handleTempAction(tempDialog.vehicleId, tempDialog.action, tempDialog.days);`,
  `handleTempAction(tempDialog.vehicleId, tempDialog.action, tempDialog.days, tempDialog.customPlate);`
);

fs.writeFileSync('src/views/AdminDashboardView.tsx', views, 'utf8');

console.log('SUCCESS');
