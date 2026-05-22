const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    } catch (e) {
      console.error("Update status failed:", e);
    }
  };`;

const replacement = `    } catch (e) {
      console.error("Update status failed:", e);
    }
  };

  const handleTempAction = async (id, action, days) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days })
      });
      if (res.ok) {
        fetchVehicles();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "アクションに失敗しました。");
      }
    } catch (e) {
      console.error(\`Temp action \${action} failed:\`, e);
      alert("エラーが発生しました");
    }
  };`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  console.log('SUCCESS');
} else {
  const targetCRLF = target.replace(/\n/g, '\r\n');
  if (c.includes(targetCRLF)) {
    c = c.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
    console.log('SUCCESS (CRLF)');
  } else {
    console.log('FAILED TO FIND TARGET');
  }
}

// Pass handleTempAction to AdminDashboardView
c = c.replace(
  `handleUpdateStatus={handleUpdateStatus}`,
  `handleUpdateStatus={handleUpdateStatus}\n            handleTempAction={handleTempAction}`
);

fs.writeFileSync('src/App.tsx', c, 'utf8');
