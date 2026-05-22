const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'VehicleImageGallery.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add containerHeight to Props
content = content.replace(
  `export const VehicleImageGallery = ({ imageData, fallbackQuery, targetTrim }: { imageData: string | undefined; fallbackQuery?: string; targetTrim?: string }) => {`,
  `export const VehicleImageGallery = ({ imageData, fallbackQuery, targetTrim, containerHeight }: { imageData: string | undefined; fallbackQuery?: string; targetTrim?: string; containerHeight?: string }) => {`
);

// Replace default heights.
content = content.replace(
  `      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)' }}>`,
  `      <div style={{ height: containerHeight || '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)' }}>`
);

content = content.replace(
  `      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)' }}>`,
  `      <div style={{ height: containerHeight || '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)' }}>`
);

content = content.replace(
  `      <div style={{ height: '200px', position: 'relative', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)', overflow: 'hidden' }}>`,
  `      <div style={{ height: containerHeight || '200px', position: 'relative', borderBottom: '1px solid var(--glass-border)', background: 'var(--panel-bg)', overflow: 'hidden' }}>`
);

content = content.replace(
  `        <div onClick={e => openAt(e, 0)} style={{ height: '200px', backgroundImage: \`url(\${images[0]})\`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid var(--glass-border)', cursor: 'zoom-in' }} />`,
  `        <div onClick={e => openAt(e, 0)} style={{ height: containerHeight || '200px', backgroundImage: \`url(\${images[0]})\`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid var(--glass-border)', cursor: 'zoom-in' }} />`
);

content = content.replace(
  `        <div className="image-gallery" style={{ height: '200px', display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>`,
  `        <div className="image-gallery" style={{ height: containerHeight || '200px', display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>`
);

content = content.replace(
  `      <div style={{ height: '200px', position: 'relative', borderBottom: '1px solid var(--glass-border)', overflow: 'hidden' }}>`,
  `      <div style={{ height: containerHeight || '200px', position: 'relative', borderBottom: '1px solid var(--glass-border)', overflow: 'hidden' }}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('VehicleImageGallery patched');
