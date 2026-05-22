const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `const handleTempAction = async (id, action, days) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days })
      });`;

const replacementStr = `const handleTempAction = async (id, action, days, customPlate) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days, custom_plate: customPlate })
      });`;

if(app.includes(targetStr)) {
  app = app.replace(targetStr, replacementStr);
  console.log("SUCCESS");
} else {
  const tCRLF = targetStr.replace(/\n/g, '\r\n');
  if(app.includes(tCRLF)) {
    app = app.replace(tCRLF, replacementStr.replace(/\n/g, '\r\n'));
    console.log("SUCCESS");
  } else {
    // try a more generic replace
    console.log("Not found, falling back to regex");
    app = app.replace(/const handleTempAction = async \(id, action, days\) => \{/g, "const handleTempAction = async (id, action, days, customPlate) => {");
    app = app.replace(/body: JSON\.stringify\(\{ id, action, days \}\)/g, "body: JSON.stringify({ id, action, days, custom_plate: customPlate })");
  }
}

fs.writeFileSync('src/App.tsx', app, 'utf8');
