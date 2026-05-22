const fs = require('fs');
const path = require('path');

const updateFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  // Use regex to replace all occurrences dynamically
  content = content.replace(/<VehicleImageGallery\s+imageData=\{v\.image_data\}\s+fallbackQuery=\{`\$\{v\.year\}\s+\$\{v\.maker\}\s+\$\{v\.model\}`\}\s*\/>/g, 
    "<VehicleImageGallery imageData={v.image_data} fallbackQuery={`${v.year} ${v.maker} ${v.model}`} targetTrim={v.trim} />"
  );
  fs.writeFileSync(filePath, content, 'utf8');
};

updateFile(path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx'));
updateFile(path.join(__dirname, 'src', 'views', 'MyGarageView.tsx'));

console.log('Views updated');
