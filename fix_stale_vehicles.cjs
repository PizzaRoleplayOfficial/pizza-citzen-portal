const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

// Insert the clearing lines after "const endpoint = ..." line
const target = `    const endpoint = isAdminView ? "/api/vehicles?admin=true" : \`/api/vehicles?userId=\${currentUser.id}\`;`;

const replacement = `    const endpoint = isAdminView ? "/api/vehicles?admin=true" : \`/api/vehicles?userId=\${currentUser.id}\`;
    // Clear stale data immediately so old results never appear in the wrong view
    if (isAdminView) {
      setVehicles([]);
      setAllSearchVehicles([]);
    } else {
      setVehicles([]);
    }`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  console.log('SUCCESS');
} else {
  console.error('target not found');
  // Try with \r\n
  const targetCRLF = target.replace(/\n/g, '\r\n');
  if (c.includes(targetCRLF)) {
    c = c.replace(targetCRLF, replacement);
    console.log('SUCCESS (CRLF)');
  }
}

fs.writeFileSync('src/App.tsx', c);
