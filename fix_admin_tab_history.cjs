const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Make view effect also include adminTab in state (can't yet, adminTab isn't in scope)
//    Instead, we'll change setAdminTabPersist to also pushState and fix popstate handler

// Replace the old popstate handler to also handle adminTab
const oldPopState = `  useEffect(() => {
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

const newPopState = `  useEffect(() => {
    // Handle browser back/forward — keep user inside the SPA
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { view?: string; adminTab?: string } | null;
      const hash = window.location.hash.replace('#', '');
      const targetView = state?.view || hash;
      if (['home', 'intro', 'garage', 'admin', 'profile', 'apply'].includes(targetView)) {
        setView(targetView as any);
        // Restore adminTab if going back/forward within admin
        if (targetView === 'admin' && state?.adminTab) {
          sessionStorage.setItem('gvvr_adminTab', state.adminTab);
          setAdminTab(state.adminTab as any);
        }
      } else {
        // Unknown/empty state — land on home without leaving the SPA
        setView('home');
        history.pushState({ view: 'home' }, '', '#home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);`;

// Replace the view pushState effect to also track adminTab when in admin
const oldViewEffect = `  useEffect(() => {
    // Push a real history entry on each view change so browser back stays in-app
    history.pushState({ view }, '', '#' + view);
  }, [view]);`;

const newViewEffect = `  useEffect(() => {
    // Push a real history entry on each view change so browser back stays in-app
    history.pushState({ view }, '', '#' + view);
  }, [view]);`;

// Replace setAdminTabPersist to also push history entry
const oldSetAdminTab = `  const setAdminTabPersist = (tab: 'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog') => {
    sessionStorage.setItem('gvvr_adminTab', tab);
    setAdminTab(tab);
  };`;

const newSetAdminTab = `  const setAdminTabPersist = (tab: 'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog') => {
    sessionStorage.setItem('gvvr_adminTab', tab);
    setAdminTab(tab);
    // Push to browser history so back button returns to previous admin tab
    history.pushState({ view: 'admin', adminTab: tab }, '', '#admin');
  };`;

if (c.includes(oldPopState.replace(/\r\n/g, '\n').slice(0, 50))) {
  c = c.replace(oldPopState.replace(/\n/g, '\r\n'), newPopState);
}
if (!c.includes('state?.adminTab')) {
  c = c.replace(oldPopState, newPopState);
}
if (!c.includes('state?.adminTab')) {
  console.error('popstate replacement failed');
}

if (c.includes(oldSetAdminTab.replace(/\n/g, '\r\n'))) {
  c = c.replace(oldSetAdminTab.replace(/\n/g, '\r\n'), newSetAdminTab);
  console.log('setAdminTabPersist replaced (CRLF)');
} else if (c.includes(oldSetAdminTab)) {
  c = c.replace(oldSetAdminTab, newSetAdminTab);
  console.log('setAdminTabPersist replaced (LF)');
} else {
  console.error('setAdminTabPersist replacement failed');
}

fs.writeFileSync('src/App.tsx', c, 'utf8');
console.log(c.includes('state?.adminTab') ? 'popstate OK' : 'popstate FAIL');
console.log(c.includes('adminTab: tab') ? 'setAdminTabPersist OK' : 'setAdminTabPersist FAIL');
