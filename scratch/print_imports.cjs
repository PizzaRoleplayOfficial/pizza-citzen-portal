const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/import\s+{[^}]+}\s+from\s+'lucide-react'/);
if (match) {
  console.log("Lucide-React Imports in App.tsx:");
  console.log(match[0]);
} else {
  // Let's print first 100 lines
  console.log(content.split('\n').slice(0, 100).join('\n'));
}
