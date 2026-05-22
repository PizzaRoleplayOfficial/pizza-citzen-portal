const fs = require('fs');
const path = require('path');

// Read backup (known good UTF-8)
let content = fs.readFileSync('src/App.tsx.backup2', 'utf8');
console.log('Backup loaded, length:', content.length);
console.log('Contains Japanese:', content.includes('モデル名'));

// Check what the backup has for pizza references
const hasPizzaWebp = content.includes('/pizza.webp');
const hasPizzaPng = content.includes('/pizza.png');
console.log('Has pizza.webp:', hasPizzaWebp, '| Has pizza.png:', hasPizzaPng);

// Check for the borderRadius change in logo img
console.log('Has borderRadius in logo:', content.includes("borderRadius: '20%'"));
console.log('Has pizza emoji:', content.includes('🍕'));

// Show lines around the logo
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('🍕') || lines[i].includes('pizza')) {
    console.log(`L${i+1}: ${lines[i].trim()}`);
  }
}
