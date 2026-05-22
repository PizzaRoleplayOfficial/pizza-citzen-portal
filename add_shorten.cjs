const fs = require('fs');

// 1. Update backend functions API
let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');

const apiTarget = `    if (action === 'extend_temp') {
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_approved', temp_expires_at = datetime(max(datetime('now'), coalesce(temp_expires_at, datetime('now'))), ?) WHERE id = ?"
      ).bind(\`+\${days} days\`, id).run();
      
      if (existing && env.DISCORD_WEBHOOK_APPLICATIONS) {
        const embedPayload = {
          title: "⏳ 仮ナンバー延長通知",
          color: 0xFBBF24,
          fields: [
            { name: "Roblox ID", value: existing.roblox_username || "未設定", inline: true },
            { name: "対象車両", value: existing.vehicle_type === 'trailer' ? \`\${existing.maker} \${existing.model} (Trailer)\` : \`\${existing.year} \${existing.maker} \${existing.model}\`, inline: false },
            { name: "既存仮ナンバー", value: existing.temp_plate || '不明', inline: true },
            { name: "延長日数", value: \`+\${days} 日間\`, inline: true }
          ],
          timestamp: new Date().toISOString()
        };
        await sendWebhook(env.DISCORD_WEBHOOK_APPLICATIONS, { embeds: [embedPayload] }).catch(console.error);
      }`;

const apiReplacement = `    if (action === 'extend_temp') {
      const modifierStr = days >= 0 ? \`+\${days} days\` : \`\${days} days\`;
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_approved', temp_expires_at = datetime(max(datetime('now'), coalesce(temp_expires_at, datetime('now'))), ?) WHERE id = ?"
      ).bind(modifierStr, id).run();
      
      if (existing && env.DISCORD_WEBHOOK_APPLICATIONS) {
        const titleStr = days >= 0 ? "⏳ 仮ナンバー延長通知" : "⏳ 仮ナンバー期間短縮通知";
        const embedPayload = {
          title: titleStr,
          color: days >= 0 ? 0xFBBF24 : 0xF97316,
          fields: [
            { name: "Roblox ID", value: existing.roblox_username || "未設定", inline: true },
            { name: "対象車両", value: existing.vehicle_type === 'trailer' ? \`\${existing.maker} \${existing.model} (Trailer)\` : \`\${existing.year} \${existing.maker} \${existing.model}\`, inline: false },
            { name: "既存仮ナンバー", value: existing.temp_plate || '不明', inline: true },
            { name: "変更日数", value: \`\${days >= 0 ? '+' : ''}\${days} 日間\`, inline: true }
          ],
          timestamp: new Date().toISOString()
        };
        await sendWebhook(env.DISCORD_WEBHOOK_APPLICATIONS, { embeds: [embedPayload] }).catch(console.error);
      }`;

if(api.includes(apiTarget)) {
  api = api.replace(apiTarget, apiReplacement);
} else {
  api = api.replace(/\r/g, '').replace(apiTarget.replace(/\r/g,''), apiReplacement.replace(/\r/g,''));
}

// issue_temp bind fix
api = api.replace(
  `.bind(tempPlate, \`+\${days} days\`, id)`,
  `.bind(tempPlate, \`+\${days} days\`, id)` // Actually issue_temp is strictly additive so it's fine
);

fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');


// 2. Update frontend UI
let views = fs.readFileSync('src/views/AdminDashboardView.tsx', 'utf8');

// Title renaming
views = views.replace(
  `🅿️ 仮ナンバー{tempDialog.action === 'issue_temp' ? '発行' : '延長'}`,
  `🅿️ 仮ナンバー{tempDialog.action === 'issue_temp' ? '発行' : '期間変更（延長・短縮）'}`
);

// Instruction renaming
views = views.replace(
  `有効日数を入力してください（7〜30日間）。`,
  `{tempDialog.action === 'issue_temp' ? '有効日数を入力してください（1〜30日間）。' : '変更する日数をスライダーで調整してください（マイナスは短縮）。'}`
);

// Min max for input range
const oldSlider = `<input 
                type="range" 
                min="1" max="30" 
                value={tempDialog.days} 
                onChange={(e) => setTempDialog({...tempDialog, days: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span>1日</span><span>30日</span>
              </div>`;

const newSlider = `<input 
                type="range" 
                min={tempDialog.action === 'issue_temp' ? "1" : "-30"} 
                max="30" 
                value={tempDialog.days} 
                onChange={(e) => setTempDialog({...tempDialog, days: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: tempDialog.days < 0 ? '#f97316' : 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span>{tempDialog.action === 'issue_temp' ? '1日' : '-30日'}</span>
                {tempDialog.action !== 'issue_temp' && <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>0日</span>}
                <span>30日</span>
              </div>`;

if(views.includes(oldSlider)) {
  views = views.replace(oldSlider, newSlider);
} else {
  views = views.replace(/\r/g, '').replace(oldSlider.replace(/\r/g,''), newSlider.replace(/\r/g,''));
}

// Button label renaming
views = views.replace(
  `{tempDialog.action === 'issue_temp' ? '発行する' : '延長する'}`,
  `{tempDialog.action === 'issue_temp' ? '発行する' : (tempDialog.days < 0 ? '短縮する' : '延長する')}`
);

// Modify Extend Button in renderTempButtons to say 変更 (Change) instead of 延長 (Extend)
const oldButtonsHelper = `<button className="btn" onClick={(e) => { e.stopPropagation(); setTempDialog({ isOpen: true, vehicleId: v.id, action: 'extend_temp', days: 7 }); }} style={{ padding: '8px 16px', background: 'rgba(163, 230, 53, 0.15)', color: '#a3e635', border: '1px solid rgba(163, 230, 53, 0.3)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}>
            ⏳ 延長
          </button>`;

const newButtonsHelper = `<button className="btn" onClick={(e) => { e.stopPropagation(); setTempDialog({ isOpen: true, vehicleId: v.id, action: 'extend_temp', days: 7 }); }} style={{ padding: '8px 16px', background: 'rgba(163, 230, 53, 0.15)', color: '#a3e635', border: '1px solid rgba(163, 230, 53, 0.3)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}>
            ⏳ 期間の変更
          </button>`;

if(views.includes(oldButtonsHelper)) {
  views = views.replace(oldButtonsHelper, newButtonsHelper);
} else {
  views = views.replace(/\r/g, '').replace(oldButtonsHelper.replace(/\r/g,''), newButtonsHelper.replace(/\r/g,''));
}

fs.writeFileSync('src/views/AdminDashboardView.tsx', views, 'utf8');
console.log('SUCCESS');
