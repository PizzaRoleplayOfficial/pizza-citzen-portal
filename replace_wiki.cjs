const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = "`\/api\/wiki-image?v=4&q=${encodeURIComponent(query)}`";
const replace1 = "`\/api\/wiki-image?v=4&q=${encodeURIComponent(query)}${formData.trim ? `&trim=${encodeURIComponent(formData.trim)}` : ''}`";

const target2 = "}, [formData.maker, formData.model, formData.year, showAddModal]);";
const replace2 = "}, [formData.maker, formData.model, formData.year, formData.trim, showAddModal]);";

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.tsx wiki fetch updated');
