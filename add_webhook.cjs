const fs = require('fs');

let api = fs.readFileSync('functions/api/vehicles.ts', 'utf8');

const target = `  try {
    await ensureTable(env.D1_DB);

    if (action === 'issue_temp') {
      const tempPlate = \`T-\${String(Math.floor(Math.random() * 900000) + 100000)}\`;
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_approved', temp_plate = ?, temp_expires_at = datetime('now', ?) WHERE id = ?"
      ).bind(tempPlate, \`+\${days} days\`, id).run();
      return new Response(JSON.stringify({ success: true, temp_plate: tempPlate }), { headers: { 'Content-Type': 'application/json' }});
    }

    if (action === 'extend_temp') {
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_approved', temp_expires_at = datetime(max(datetime('now'), coalesce(temp_expires_at, datetime('now'))), ?) WHERE id = ?"
      ).bind(\`+\${days} days\`, id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
    }

    if (action === 'revoke_temp') {
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_expired' WHERE id = ?"
      ).bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
    }`;

const replacement = `  try {
    await ensureTable(env.D1_DB);
    const existing = await env.D1_DB.prepare("SELECT * FROM vehicles WHERE id = ?").bind(id).first() as any;

    if (action === 'issue_temp') {
      const tempPlate = \`T-\${String(Math.floor(Math.random() * 900000) + 100000)}\`;
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_approved', temp_plate = ?, temp_expires_at = datetime('now', ?) WHERE id = ?"
      ).bind(tempPlate, \`+\${days} days\`, id).run();
      
      if (existing && env.DISCORD_WEBHOOK_APPLICATIONS) {
        const embedPayload = {
          title: "🅿️ 仮ナンバー発行通知",
          color: 0xEF4444,
          fields: [
            { name: "Roblox ID", value: existing.roblox_username || "未設定", inline: true },
            { name: "対象車両", value: existing.vehicle_type === 'trailer' ? \`\${existing.maker} \${existing.model} (Trailer)\` : \`\${existing.year} \${existing.maker} \${existing.model}\`, inline: false },
            { name: "仮ナンバー", value: tempPlate, inline: true },
            { name: "有効日数", value: \`\${days} 日間\`, inline: true }
          ],
          timestamp: new Date().toISOString()
        };
        await sendWebhook(env.DISCORD_WEBHOOK_APPLICATIONS, { embeds: [embedPayload] }).catch(console.error);
      }
      
      return new Response(JSON.stringify({ success: true, temp_plate: tempPlate }), { headers: { 'Content-Type': 'application/json' }});
    }

    if (action === 'extend_temp') {
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
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
    }

    if (action === 'revoke_temp') {
      await env.D1_DB.prepare(
        "UPDATE vehicles SET status = 'temp_expired' WHERE id = ?"
      ).bind(id).run();
      
      if (existing && env.DISCORD_WEBHOOK_APPLICATIONS) {
        const embedPayload = {
          title: "🛑 仮ナンバー失効通知",
          color: 0x9CA3AF,
          fields: [
            { name: "Roblox ID", value: existing.roblox_username || "未設定", inline: true },
            { name: "対象車両", value: existing.vehicle_type === 'trailer' ? \`\${existing.maker} \${existing.model} (Trailer)\` : \`\${existing.year} \${existing.maker} \${existing.model}\`, inline: false },
            { name: "失効したナンバー", value: existing.temp_plate || '不明', inline: true }
          ],
          timestamp: new Date().toISOString()
        };
        await sendWebhook(env.DISCORD_WEBHOOK_APPLICATIONS, { embeds: [embedPayload] }).catch(console.error);
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
    }`;

if(api.includes(target)) {
  api = api.replace(target, replacement);
  console.log("SUCCESS WITH LF");
} else {
  const tCRLF = target.replace(/\n/g, '\r\n');
  if(api.includes(tCRLF)) {
    api = api.replace(tCRLF, replacement.replace(/\n/g, '\r\n'));
    console.log("SUCCESS WITH CRLF");
  } else {
    console.log("Not found");
  }
}

fs.writeFileSync('functions/api/vehicles.ts', api, 'utf8');
