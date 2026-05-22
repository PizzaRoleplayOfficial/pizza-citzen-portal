const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'VehicleImageGallery.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = "export const VehicleImageGallery = ({ imageData, fallbackQuery }: { imageData: string | undefined; fallbackQuery?: string }) => {";
const replace1 = "export const VehicleImageGallery = ({ imageData, fallbackQuery, targetTrim }: { imageData: string | undefined; fallbackQuery?: string; targetTrim?: string }) => {";

const target2 = "fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(fallbackQuery)}`)";
const replace2 = "fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(fallbackQuery)}${targetTrim ? `&trim=${encodeURIComponent(targetTrim)}` : ''}`)";

const target3 = "  }, [fallbackQuery, images.length]);";
const replace3 = "  }, [fallbackQuery, targetTrim, images.length]);";

content = content.replace(target1, replace1);
content = content.replace(target2, replace2);
content = content.replace(target3, replace3);

fs.writeFileSync(filePath, content, 'utf8');
console.log('VehicleImageGallery updated');
