const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

// Replace using regex to handle both \r\n and \n line endings
const oldPattern = /useEffect\(\(\) => \{\r?\n    window\.location\.hash = view;\r?\n  \}, \[view\]\);\r?\n\r?\n  useEffect\(\(\) => \{\r?\n    const handleHashChange = \(\) => \{\r?\n      const hash = window\.location\.hash\.replace\('#', ''\);\r?\n      if \(\['home', 'intro', 'garage', 'admin', 'profile', 'apply'\]\.includes\(hash\)\) \{\r?\n        setView\(hash as any\);\r?\n      \}\r?\n    \};\r?\n    window\.addEventListener\('hashchange', handleHashChange\);\r?\n    return \(\) => window\.removeEventListener\('hashchange', handleHashChange\);\r?\n  \}, \[\]\);/;

const newBlock = `useEffect(() => {
    // Push a real history entry on each view change so browser back stays in-app
    history.pushState({ view }, '', '#' + view);
  }, [view]);

  useEffect(() => {
    // Handle browser back/forward — keep user inside the SPA
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { view?: string } | null;
      const hash = window.location.hash.replace('#', '');
      const targetView = state?.view || hash;
      if (['home', 'intro', 'garage', 'admin', 'profile', 'apply'].includes(targetView)) {
        setView(targetView as any);
      } else {
        // Unknown/empty state — land on home without leaving the SPA
        setView('home');
        history.pushState({ view: 'home' }, '', '#home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);`;

if (oldPattern.test(c)) {
  c = c.replace(oldPattern, newBlock);
  console.log('SUCCESS');
} else {
  console.error('Pattern not matched');
}

fs.writeFileSync('src/App.tsx', c, 'utf8');
