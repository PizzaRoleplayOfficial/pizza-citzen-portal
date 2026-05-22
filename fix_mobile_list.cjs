const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `                    <div key={v.id} className="glass card view-anim" style={{ 
                      padding: 0, overflow: 'hidden', display: 'flex', 
                      flexDirection: isList ? (isMobile ? 'column' : 'row') : 'column', 
                      height: '100%' 
                    }}>
                      <div style={{ 
                        height: isList ? (isMobile ? '120px' : '100%') : '220px', 
                        width: isList ? (isMobile ? '100%' : '250px') : '100%', 
                        position: 'relative', overflow: 'hidden', flexShrink: 0,
                        borderRight: isList && !isMobile ? '1px solid var(--glass-border)' : 'none',
                        borderBottom: isList && !isMobile ? 'none' : '1px solid var(--glass-border)'
                      }}>
                        <div style={{ width: '100%', height: '100%', transform: isList && !isMobile ? 'scale(1.2)' : 'none', transformOrigin: 'center' }}>
                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />
                        </div>
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                          <StatusBadge status={v.status} reason={v.reject_reason} />
                        </div>
                      </div>
                      <div style={{ 
                        padding: isMobile && isList ? '16px' : '24px', 
                        flex: 1, display: 'flex', 
                        flexDirection: isList && !isMobile ? 'row' : 'column', 
                        gap: isMobile && isList ? '8px' : '16px', 
                        alignItems: isList && !isMobile ? 'center' : 'stretch' 
                      }}>`;

const replaceStr = `                    <div key={v.id} className="glass card view-anim" style={{ 
                      padding: 0, overflow: 'hidden', display: 'flex', 
                      flexDirection: isList ? 'row' : 'column', 
                      height: '100%' 
                    }}>
                      <div style={{ 
                        height: isList ? '100%' : '220px', 
                        width: isList ? (isMobile ? '140px' : '250px') : '100%', 
                        position: 'relative', overflow: 'hidden', flexShrink: 0,
                        borderRight: isList ? '1px solid var(--glass-border)' : 'none',
                        borderBottom: isList ? 'none' : '1px solid var(--glass-border)'
                      }}>
                        <div style={{ width: '100%', height: '100%', transform: isList && !isMobile ? 'scale(1.2)' : 'none', transformOrigin: 'center' }}>
                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />
                        </div>
                        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, transform: isMobile && isList ? 'scale(0.8)' : 'none', transformOrigin: 'top left' }}>
                          <StatusBadge status={v.status} reason={v.reject_reason} />
                        </div>
                      </div>
                      <div style={{ 
                        padding: isList && isMobile ? '16px' : '24px', 
                        flex: 1, display: 'flex', 
                        flexDirection: isList && !isMobile ? 'row' : 'column', 
                        gap: isList && isMobile ? '8px' : '16px', 
                        alignItems: isList && !isMobile ? 'center' : 'stretch' 
                      }}>`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Mobile list view patched');
