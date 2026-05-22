const fs = require('fs');

// ==== 1. Update App.tsx ====
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Add vehicleSubmitting state to App.tsx
if (!app.includes('const [vehicleSubmitting, setVehicleSubmitting] = useState(false);')) {
  app = app.replace(
    'const [trailerSubmitting, setTrailerSubmitting] = useState(false);',
    'const [vehicleSubmitting, setVehicleSubmitting] = useState(false);\n  const [trailerSubmitting, setTrailerSubmitting] = useState(false);'
  );
}

// Add checks to handleSubmitVehicle
const submitTarget = `  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingVehicleId ? 'PUT' : 'POST';`;
const submitReplacement = `  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vehicleSubmitting) return;
    setVehicleSubmitting(true);
    const method = editingVehicleId ? 'PUT' : 'POST';`;

if (app.includes(submitTarget)) {
  app = app.replace(submitTarget, submitReplacement);
} else if (app.replace(/\r/g,'').includes(submitTarget)) {
  app = app.replace(/\r/g,'').replace(submitTarget, submitReplacement);
}

// Add finally block to handleSubmitVehicle
const finallyTargetCRLF = `
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
    }
  };`;
const finallyReplacementCRLF = `
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
    } finally {
      setVehicleSubmitting(false);
    }
  };`;

// Try both with and without CR
if (app.includes(finallyTargetCRLF)) {
  app = app.replace(finallyTargetCRLF, finallyReplacementCRLF);
} else if (app.replace(/\r/g,'').includes(finallyTargetCRLF.replace(/\r/g,''))) {
  app = app.replace(/\r/g,'').replace(finallyTargetCRLF.replace(/\r/g,''), finallyReplacementCRLF.replace(/\r/g,''));
}

// Update UI buttons inside App.tsx
app = app.replace(
  `]}>キャンセル</button>\n                    <button type="submit"`,
  `]} disabled={vehicleSubmitting}>キャンセル</button>\n                    <button type="submit"`
);
app = app.replace(
  `</div>\n                        </div>\n                      </div>\n                    </div>\n                    <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }}>\n                      🚘 登録申請を送信\n                    </button>`,
  `</div>\n                        </div>\n                      </div>\n                    </div>\n                    <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }} disabled={vehicleSubmitting}>\n                      {vehicleSubmitting ? '送信中...' : '🚘 登録申請を送信'}\n                    </button>`
);

fs.writeFileSync('src/App.tsx', app, 'utf8');

// ==== 2. Update functions/api/vehicles.ts ====
let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');
api = api.replace(
  "const tempPlate = \`仮-\${String(Math.floor(Math.random() * 9000) + 1000)}\`;",
  "const tempPlate = \`T-\${String(Math.floor(Math.random() * 900000) + 100000)}\`;"
);
fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');

// ==== 3. Update src/views/MyGarageView.tsx ====
let views = fs.readFileSync('src/views/MyGarageView.tsx', 'utf8');
const oldTag = `<div style={{ fontSize: '0.7rem', color: '#a3e635', marginBottom: '10px', letterSpacing: '0.05em' }}>TEMP PLATE (仮ナンバー)</div>
                        <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '2px dashed #a3e635' }}>
                           <div style={{ background: 'rgba(163, 230, 53, 0.1)', color: '#a3e635', padding: '10px 20px', fontSize: '1.3rem', fontWeight: 800, fontFamily: 'monospace, sans-serif' }}>
                            {(v as any).temp_plate}
                          </div>
                        </div>`;

const newTag = `<div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '10px', letterSpacing: '0.05em', fontWeight: 800 }}>TEMPORARY TAG</div>
                        <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '2px solid #ef4444', background: '#fff', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}>
                           <div style={{ background: '#ef4444', color: '#fff', padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', letterSpacing: '0.1em' }}>
                             TEMP
                           </div>
                           <div style={{ background: '#fff', color: '#000', padding: '10px 20px', fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace, sans-serif', letterSpacing: '2px' }}>
                            {(v as any).temp_plate}
                          </div>
                        </div>`;

if(views.includes(oldTag)) {
  views = views.replace(oldTag, newTag);
} else {
  views = views.replace(/\r/g, '').replace(oldTag.replace(/\r/g, ''), newTag.replace(/\r/g, ''));
}
fs.writeFileSync('src/views/MyGarageView.tsx', views, 'utf8');

console.log('SUCCESS');
