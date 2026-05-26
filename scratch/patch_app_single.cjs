const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(query)}\${formData.trim ? `&trim=\${encodeURIComponent(formData.trim)}` : ''}`)";
const replacementStr = "fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(query)}&gameType=\${formData.game_type}\${formData.trim ? `&trim=\${encodeURIComponent(formData.trim)}` : ''}`)";

if (content.indexOf(targetStr) !== -1) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("SUCCESS: wikiImage fetch call patched successfully!");
} else {
  console.log("ERROR: Target string not found!");
}
