const fs = require('fs');

// ---- AdminDashboardView.tsx ----
let c = fs.readFileSync('src/views/AdminDashboardView.tsx', 'utf8');

// Add import
c = c.replace(
  `import { formatDate } from '../utils/helpers';`,
  `import { formatDate } from '../utils/helpers';\nimport { handleAvatarError } from '../utils/avatarFallback';`
);

// Fix avatar img in user card (list view - smaller)
c = c.replace(
  `src={u.avatar} style={{ width: isList ? '48px' : '64px', height: isList ? '48px' : '64px', borderRadius: '12px' }}`,
  `src={u.avatar} onError={e => handleAvatarError(e, u.username)} style={{ width: isList ? '48px' : '64px', height: isList ? '48px' : '64px', borderRadius: '12px' }}`
);

// Fix avatar img in user detail modal
c = c.replace(
  `src={u.avatar} style={{ width: '64px', height: '64px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)' }}`,
  `src={u.avatar} onError={e => handleAvatarError(e, u.username)} style={{ width: '64px', height: '64px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)' }}`
);

fs.writeFileSync('src/views/AdminDashboardView.tsx', c, 'utf8');
console.log('AdminDashboardView: avatar fallback added');
console.log('has handleAvatarError import:', c.includes('handleAvatarError'));

// ---- App.tsx ----
let a = fs.readFileSync('src/App.tsx', 'utf8');

// Add import if not present
if (!a.includes('handleAvatarError')) {
  a = a.replace(
    `import { formatDate } from './utils/helpers';`,
    `import { formatDate } from './utils/helpers';\nimport { handleAvatarError } from './utils/avatarFallback';`
  );
}

// Find all avatar img tags in App.tsx and add onError fallback
// Pattern: src={currentUser.avatar} style={{ ... }}
// There could be multiple — let's use a targeted approach
const avatarPatterns = [
  // Mobile header
  [`src={currentUser.avatar} alt="u" style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fff', objectFit: 'cover' }}`,
   `src={currentUser.avatar} onError={e => handleAvatarError(e, currentUser.username)} alt="u" style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fff', objectFit: 'cover' }}`],
  // Desktop nav
  [`src={currentUser.avatar} alt="u" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff', objectFit: 'cover' }}`,
   `src={currentUser.avatar} onError={e => handleAvatarError(e, currentUser.username)} alt="u" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff', objectFit: 'cover' }}`],
  // Home view large avatar
  [`src={currentUser.avatar} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid var(--primary)', objectFit: 'cover' }}`,
   `src={currentUser.avatar} onError={e => handleAvatarError(e, currentUser.username)} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid var(--primary)', objectFit: 'cover' }}`],
];

for (const [before, after] of avatarPatterns) {
  if (a.includes(before)) {
    a = a.replace(before, after);
    console.log('Replaced avatar in App.tsx:', before.slice(0, 60));
  }
}

fs.writeFileSync('src/App.tsx', a, 'utf8');
console.log('App.tsx done. has handleAvatarError:', a.includes('handleAvatarError'));
