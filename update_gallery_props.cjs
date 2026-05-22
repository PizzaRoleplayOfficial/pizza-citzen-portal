const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// For vehicles in dashboard list
// Replace `<VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />`
// With `<VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} containerHeight="100%" />`

content = content.replace(
  `                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />`,
  `                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} containerHeight="100%" />`
);

content = content.replace(
  `                        <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />`,
  `                        <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} containerHeight="100%" />`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added containerHeight="100%" in AdminDashboardView.tsx');
