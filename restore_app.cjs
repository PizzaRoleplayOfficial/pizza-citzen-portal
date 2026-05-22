const fs = require('fs');
const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I will look for EXACTLY this:
const searchTarget = `                )}
          <div className="nav-right">`;

// I will replace it with:
const replaceWith = `                )}
              </button>
              <button className={\`btn nav-btn \${view === 'profile' ? 'active' : ''}\`} onClick={() => setView('profile')}>
                <UserIcon size={18} /> メニュー(設定)
              </button>
              {currentUser.role === 'admin' && (
                <button className={\`btn nav-btn \${view === 'admin' ? 'active' : ''}\`} onClick={() => setView('admin')}>
                  <ShieldCheck size={18} /> 運営パネル
                </button>
              )}
            </div>
          </div>

          <div className="nav-right">`;

content = content.replace(searchTarget, replaceWith);
content = content.replace(searchTarget.replace(/\n/g, '\r\n'), replaceWith);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Restored App.tsx directly.');
