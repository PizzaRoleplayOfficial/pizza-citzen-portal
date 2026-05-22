const fs = require('fs');

// ===== 1. Update functions/api/vehicles.ts POST handler =====
let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');

// Extract body fields to include is_temp_registration
const oldExtract = `  const { maker, model, year, trim, color, plate, plate_region, roblox_username, owner_id, image_data, vehicle_type, trailer_type } = body;`;
const newExtract = `  const { maker, model, year, trim, color, plate, plate_region, roblox_username, owner_id, image_data, vehicle_type, trailer_type, is_temp_registration, temp_days } = body;`;

api = api.replace(oldExtract, newExtract);

// Update the INSERT to support temp registration
const oldInsert = `    await env.D1_DB.prepare(
      "INSERT INTO vehicles (id, owner_id, maker, model, year, trim, color, plate, plate_region, roblox_username, image_data, vehicle_type, trailer_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, owner_id, maker || '', model, year || 2024, trim, color, plate, plate_region, roblox_username, image_data || null, vehicle_type || 'car', trailer_type || null).run();`;

const newInsert = `    if (is_temp_registration) {
      // Temp registration: status=temp_approved, plate field = regular placeholder, temp_plate = user's plate
      const expiresModifier = \`+\${Number(temp_days) || 7} days\`;
      await env.D1_DB.prepare(
        "INSERT INTO vehicles (id, owner_id, maker, model, year, trim, color, plate, plate_region, roblox_username, image_data, vehicle_type, trailer_type, status, temp_plate, temp_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'temp_approved', ?, datetime('now', ?))"
      ).bind(id, owner_id, maker || '', model, year || 2024, trim, color, plate, plate_region, roblox_username, image_data || null, vehicle_type || 'car', trailer_type || null, plate, expiresModifier).run();
    } else {
      await env.D1_DB.prepare(
        "INSERT INTO vehicles (id, owner_id, maker, model, year, trim, color, plate, plate_region, roblox_username, image_data, vehicle_type, trailer_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, owner_id, maker || '', model, year || 2024, trim, color, plate, plate_region, roblox_username, image_data || null, vehicle_type || 'car', trailer_type || null).run();
    }`;

api = api.replace(oldInsert, newInsert);

// Update Discord notification title + fields for temp registration
const oldDiscordTitle = `        title: "🚗 新規車両登録の申請",
        color: 0xFF9E00,`;
const newDiscordTitle = `        title: is_temp_registration ? "🅿️ 仮ナンバー付き車両登録の申請" : "🚗 新規車両登録の申請",
        color: is_temp_registration ? 0xEF4444 : 0xFF9E00,`;

api = api.replace(oldDiscordTitle, newDiscordTitle);

// Add temp plate field to Discord embed when is_temp_registration
const oldPlateField = `          { name: "ナンバープレート", value: \`[\${plate_region}] \${plate}\`, inline: true }
        ],
        timestamp: new Date().toISOString(),
      };`;
const newPlateField = `          { name: "ナンバープレート", value: \`[\${plate_region}] \${plate}\`, inline: true },
          ...(is_temp_registration ? [{ name: "🅿️ 仮ナンバー", value: \`\${plate} (有効期限: \${Number(temp_days) || 7}日間)\`, inline: false }] : [])
        ],
        timestamp: new Date().toISOString(),
      };`;

api = api.replace(oldPlateField, newPlateField);

fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');
console.log('API OK');

// ===== 2. Update App.tsx =====
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Add registrationMode state near vehicleSubmitting
const oldState = `  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);`;
const newState = `  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'normal' | 'temp'>('normal');
  const [tempRegDays, setTempRegDays] = useState(7);`;

app = app.replace(oldState, newState);

// Reset registrationMode when modal closes/opens
app = app.replace(
  `setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
        fetchVehicles();`,
  `setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
        setRegistrationMode('normal');
        setTempRegDays(7);
        fetchVehicles();`
);

// Update handleSubmitVehicle payload
const oldPayload = `      const payload = { ...formData, owner_id: currentUser.id };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });`;

const newPayload = `      const payload = { ...formData, owner_id: currentUser.id, is_temp_registration: (registrationMode === 'temp' && !editingVehicleId) ? true : undefined, temp_days: (registrationMode === 'temp' && !editingVehicleId) ? tempRegDays : undefined };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });`;

app = app.replace(oldPayload, newPayload);

fs.writeFileSync('src/App.tsx', app, 'utf8');
console.log('App.tsx state/payload OK');
