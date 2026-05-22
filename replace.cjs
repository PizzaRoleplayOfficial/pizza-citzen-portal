const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add adminStats state
content = content.replace(
  "const [userSortOrder, setUserSortOrder] = useState<'newest' | 'oldest' | 'maker'>('newest');",
  "const [userSortOrder, setUserSortOrder] = useState<'newest' | 'oldest' | 'maker'>('newest');\n  const [adminStats, setAdminStats] = useState({ pendingVehicles: 0, pendingApps: 0, totalPending: 0 });"
);

// 2. Add fetchAdminStats
content = content.replace(
  "const fetchQuestions = async (adminMode = false) => {\n    try {\n      const res = await fetch(adminMode ? '/api/questions?admin=true' : '/api/questions');\n      if (res.ok) {\n        const data = await res.json() as any[];\n        if (adminMode) setAllQuestionsAdmin(Array.isArray(data) ? data : []);\n        else setQuestions(Array.isArray(data) ? data : []);\n      }\n    } catch (e) { console.error('Fetch questions failed:', e); }\n  };",
  "const fetchQuestions = async (adminMode = false) => {\n    try {\n      const res = await fetch(adminMode ? '/api/questions?admin=true' : '/api/questions');\n      if (res.ok) {\n        const data = await res.json() as any[];\n        if (adminMode) setAllQuestionsAdmin(Array.isArray(data) ? data : []);\n        else setQuestions(Array.isArray(data) ? data : []);\n      }\n    } catch (e) { console.error('Fetch questions failed:', e); }\n  };\n\n  const fetchAdminStats = async () => {\n    try {\n      const res = await fetch('/api/admin-stats');\n      if (res.ok) { setAdminStats(await res.json()); }\n    } catch (e) { console.error('Fetch admin stats failed:', e); }\n  };"
);

// 3. Update handleManualRefresh
content = content.replace(
  "  const handleManualRefresh = () => {\n    if (!isLoggedIn) return;\n    setIsLoading(true);\n    fetchVehicles();\n    fetchApplication();\n    fetchQuestions();\n    if (view === 'admin') {\n      fetchUsers();\n      fetchAllApplications();\n      fetchQuestions(true);\n    }\n  };",
  "  const handleManualRefresh = () => {\n    if (!isLoggedIn) return;\n    setIsLoading(true);\n    fetchVehicles();\n    fetchApplication();\n    fetchQuestions();\n    if (currentUser?.role === 'admin') fetchAdminStats();\n    if (view === 'admin') {\n      fetchUsers();\n      fetchAllApplications();\n      fetchQuestions(true);\n    }\n  };"
);

// 4. Update refreshData inside useEffect
content = content.replace(
  "    const refreshData = () => {\n      fetchVehicles();\n      fetchApplication();\n      fetchQuestions();\n      if (view === 'admin') {\n        fetchUsers();\n        fetchAllApplications();\n        fetchQuestions(true);\n      }\n    };",
  "    const refreshData = () => {\n      fetchVehicles();\n      fetchApplication();\n      fetchQuestions();\n      if (currentUser?.role === 'admin') fetchAdminStats();\n      if (view === 'admin') {\n        fetchUsers();\n        fetchAllApplications();\n        fetchQuestions(true);\n      }\n    };"
);

// 5. Update Manage Panel text and add Notification Badge
content = content.replace(
  "<button className={`btn nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>\n                  <ShieldCheck size={18} /> 管理パネル\n                </button>",
  "<button className={`btn nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')} style={{ position: 'relative' }}>\n                  <ShieldCheck size={18} /> 運営パネル\n                  {adminStats.totalPending > 0 && <span className=\"nav-badge\">{adminStats.totalPending}</span>}\n                </button>"
);

// 6. Fix handleUpdateStatus for 'approved_warning' (restoring the previous conversation functionality since it was overridden by backup)
content = content.replace(
  "  const handleUpdateStatus = async (id: string, status: VehicleStatus) => {\n    let rejectReason = '';\n    if (status === 'rejected') {\n      const reason = prompt(\"却下する理由を入力してください（空欄でも可）:\");\n      if (reason === null) return; // User cancelled\n      rejectReason = reason;\n    }",
  "  const handleUpdateStatus = async (id: string, status: VehicleStatus) => {\n    let rejectReason = '';\n    if (status === 'rejected' || status === 'approved_warning') {\n      const reason = prompt(status === 'rejected' ? \"却下する理由を入力してください（空欄でも可）:\" : \"非推奨とする理由を入力してください (必須):\");\n      if (reason === null) return; // User cancelled\n      if (status === 'approved_warning' && !reason.trim()) {\n        alert(\"非推奨での承認には理由の入力が必須です。\");\n        return;\n      }\n      rejectReason = reason;\n    }"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replacements complete');
