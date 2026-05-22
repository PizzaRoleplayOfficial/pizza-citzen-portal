const fs = require('fs');

// ===== 1. Update functions/api/vehicles.ts =====
let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');

// Add requested_temp_plate to auto-migration columns
api = api.replace(
  `    const vColsToAdd = ['plate_region', 'roblox_username', 'image_data', 'reject_reason', 'vehicle_type', 'trailer_type', 'temp_plate', 'temp_expires_at'];`,
  `    const vColsToAdd = ['plate_region', 'roblox_username', 'image_data', 'reject_reason', 'vehicle_type', 'trailer_type', 'temp_plate', 'temp_expires_at', 'requested_temp_plate'];`
);

// Fix POST: don't immediately set temp_approved - just save pending + requested_temp_plate
const oldTempInsert = `    if (is_temp_registration) {
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

const newTempInsert = `    if (is_temp_registration) {
      // Temp registration: save as PENDING with requested_temp_plate for admin to approve as temp
      await env.D1_DB.prepare(
        "INSERT INTO vehicles (id, owner_id, maker, model, year, trim, color, plate, plate_region, roblox_username, image_data, vehicle_type, trailer_type, requested_temp_plate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, owner_id, maker || '', model, year || 2024, trim, color, plate, plate_region, roblox_username, image_data || null, vehicle_type || 'car', trailer_type || null, plate).run();
    } else {
      await env.D1_DB.prepare(
        "INSERT INTO vehicles (id, owner_id, maker, model, year, trim, color, plate, plate_region, roblox_username, image_data, vehicle_type, trailer_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, owner_id, maker || '', model, year || 2024, trim, color, plate, plate_region, roblox_username, image_data || null, vehicle_type || 'car', trailer_type || null).run();
    }`;

if (api.includes(oldTempInsert)) {
  api = api.replace(oldTempInsert, newTempInsert);
  console.log('API insert fix OK');
} else {
  api = api.replace(/\r/g, '').replace(oldTempInsert.replace(/\r/g, ''), newTempInsert.replace(/\r/g, ''));
  console.log('API insert fix OK (CRLF)');
}

// Fix Discord title to show "仮ナンバー希望" for is_temp_registration (not "仮ナンバー付き")
api = api.replace(
  `        title: is_temp_registration ? "🅿️ 仮ナンバー付き車両登録の申請" : "🚗 新規車両登録の申請",`,
  `        title: is_temp_registration ? "🅿️ 仮ナンバー希望の車両登録申請（審査待ち）" : "🚗 新規車両登録の申請",`
);

fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');

// ===== 2. Update src/types.ts to add requested_temp_plate =====
let types = fs.readFileSync('src/types.ts', 'utf8');
if (!types.includes('requested_temp_plate')) {
  types = types.replace(
    `  temp_expires_at?: string;`,
    `  temp_expires_at?: string;\n  requested_temp_plate?: string;`
  );
  fs.writeFileSync('src/types.ts', types, 'utf8');
  console.log('types.ts OK');
}

// ===== 3. Update AdminDashboardView to show "仮ナンバー希望" badge and pre-fill plate =====
let views = fs.readFileSync('src/views/AdminDashboardView.tsx', 'utf8');

// When opening temp dialog from pending vehicle that has requested_temp_plate, pre-fill it
const oldIssueBtn = `setTempDialog({ isOpen: true, vehicleId: v.id, action: 'issue_temp', days: 7, customPlate: '' });`;
const newIssueBtn = `setTempDialog({ isOpen: true, vehicleId: v.id, action: 'issue_temp', days: 7, customPlate: v.requested_temp_plate || '' });`;

if (views.includes(oldIssueBtn)) {
  views = views.replace(oldIssueBtn, newIssueBtn);
  console.log('views issue btn OK');
} else {
  views = views.replace(/\r/g, '').replace(oldIssueBtn.replace(/\r/g, ''), newIssueBtn.replace(/\r/g, ''));
  console.log('views issue btn OK (CRLF)');
}

fs.writeFileSync('src/views/AdminDashboardView.tsx', views, 'utf8');
console.log('ALL DONE');
