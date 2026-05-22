import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Plus, 
  Search as SearchIcon, 
  LogOut, 
  ShieldCheck, 
  Trash2, 
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  LayoutDashboard,
  User as UserIcon,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react';

type VehicleStatus = 'approved' | 'pending' | 'rejected';

interface Vehicle {
  id: string;
  owner_id: string;
  maker: string;
  model: string;
  year: number;
  trim: string;
  color: string;
  plate: string;
  plate_region: string;
  status: VehicleStatus;
  roblox_username: string;
  discord_username?: string;
  discord_avatar?: string;
  image_data?: string;
}

interface User {
  id: string;
  username: string;
  avatar: string;
  role: 'user' | 'admin';
  roblox_username?: string;
}

const INITIAL_USER: User = {
  id: '12345',
  username: 'Keabu_Roblox',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Keabu',
  role: 'user'
};

const StatusBadge = ({ status }: { status: VehicleStatus }) => {
  const configs = {
    approved: { icon: CheckCircle2, color: 'var(--success)', text: '承認済み' },
    pending: { icon: Clock, color: 'var(--secondary)', text: '審査中' },
    rejected: { icon: XCircle, color: 'var(--error)', text: '却下' }
  };
  const config = configs[status] || configs.pending;
  const { icon: Icon, color, text } = config;
  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px', 
      color, 
      fontSize: '0.8rem', 
      fontWeight: '600',
      background: `${color}15`,
      padding: '4px 10px',
      borderRadius: '20px',
      border: `1px solid ${color}30`
    }}>
      <Icon size={14} />
      {text}
    </span>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USER);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<'garage' | 'admin' | 'profile'>('garage');
  const [adminTab, setAdminTab] = useState<'vehicles' | 'users' | 'lookup'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allSearchVehicles, setAllSearchVehicles] = useState<Vehicle[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [selectedUserForVehicles, setSelectedUserForVehicles] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    maker: '',
    model: '',
    year: 2024,
    trim: '',
    color: '',
    plate: '',
    plate_region: 'WISCONSIN',
    roblox_username: '',
    image_data: ''
  });

  const fetchVehicles = async () => {
    setIsLoading(true);
    const isAdminView = view === 'admin';
    const endpoint = isAdminView ? "/api/vehicles?admin=true" : "/api/vehicles";
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (isAdminView) {
          setAllSearchVehicles(list);
          setVehicles(list.filter(v => v.status === 'pending'));
        } else {
          setVehicles(list);
        }
      }
    } catch (e) {
      console.error("Fetch vehicles failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (view !== 'admin') return;
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch users failed:", e);
    }
  };

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user as User);
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLogin();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchVehicles();
      if (view === 'admin') fetchUsers();
    }
  }, [isLoggedIn, view]);

  const handleUpdateStatus = async (id: string, status: VehicleStatus) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) fetchVehicles();
    } catch (e) {
      console.error("Update status failed:", e);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error("Update role failed:", e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser.id, roblox_username: currentUser.roblox_username })
      });
      if (res.ok) alert("プロフィールを更新しました。");
    } catch (e) {
      console.error("Update profile failed:", e);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("車両を削除しますか？")) return;
    try {
      const res = await fetch(`/api/vehicles?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchVehicles();
    } catch (e) {
      console.error("Delete vehicle failed:", e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, image_data: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleStartEdit = (v: Vehicle) => {
    setFormData({
      maker: v.maker, model: v.model, year: v.year, trim: v.trim || '', color: v.color || '',
      plate: v.plate, plate_region: v.plate_region || 'WISCONSIN',
      roblox_username: v.roblox_username, image_data: v.image_data || ''
    });
    setEditingVehicleId(v.id);
    setShowAddModal(true);
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingVehicleId ? 'PUT' : 'POST';
    try {
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...formData, id: editingVehicleId } : formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchVehicles();
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
    }
  };

  if (isLoading && !isLoggedIn) return <div className="loading-screen">Loading...</div>;

  if (!isLoggedIn) {
    return (
      <div className="login-screen" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass card" style={{ padding: '40px', textAlign: 'center' }}>
          <Car size={64} style={{ color: 'var(--primary)', marginBottom: '24px' }} />
          <h1>GreenVille Registry</h1>
          <p>車両登録管理システムへようこそ。</p>
          <a href="/api/auth/login" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
             Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <nav className="glass" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--glass-border)', padding: '16px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setView('garage')}>
            <Car size={24} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>GVVR</h1>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <span onClick={() => setView('garage')} style={{ cursor: 'pointer', fontWeight: view === 'garage' ? 700 : 400 }}>Garage</span>
            <span onClick={() => setView('profile')} style={{ cursor: 'pointer', fontWeight: view === 'profile' ? 700 : 400 }}>Profile</span>
            {currentUser.role === 'admin' && <span onClick={() => setView('admin')} style={{ cursor: 'pointer', fontWeight: view === 'admin' ? 700 : 400 }}>Admin</span>}
            <img src={currentUser.avatar} alt="u" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            <a href="/api/auth/logout"><LogOut size={18} /></a>
          </div>
        </div>
      </nav>

      <main className="container" style={{ padding: '40px 0' }}>
        {view === 'garage' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
              <div>
                <h2>My Garage</h2>
                <p style={{ color: 'var(--text-muted)' }}>管理中の車両一覧です。</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                setEditingVehicleId(null);
                setShowAddModal(true);
              }}>
                <Plus size={18} /> 車両追加
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {vehicles.map(v => (
                <div key={v.id} className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
                  {v.image_data && <div style={{ height: '160px', backgroundImage: `url(${v.image_data})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.2rem' }}>{v.year} {v.maker} {v.model}</h3>
                      <StatusBadge status={v.status} />
                    </div>
                    <div style={{ background: '#fff', color: '#111', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '16px' }}>{v.plate}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" onClick={() => handleStartEdit(v)} style={{ flex: 1, fontSize: '0.8rem' }}>編集</button>
                      <button className="btn btn-secondary" onClick={() => handleDeleteVehicle(v.id)} style={{ flex: 1, fontSize: '0.8rem', color: 'var(--error)' }}>削除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : view === 'profile' ? (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>Profile Settings</h2>
            <form onSubmit={handleUpdateProfile} className="glass card" style={{ marginTop: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>Roblox ユーザー名</label>
                <input type="text" value={currentUser.roblox_username || ''} onChange={e => setCurrentUser({...currentUser, roblox_username: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: '#fff' }} />
              </div>
              <button type="submit" className="btn btn-primary">保存</button>
            </form>
          </div>
        ) : (
          <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2>Admin Panel</h2>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                <button onClick={() => setAdminTab('vehicles')} className={`btn ${adminTab === 'vehicles' ? 'btn-primary' : ''}`} style={{ fontSize: '0.8rem', padding: '6px 16px' }}>申請</button>
                <button onClick={() => setAdminTab('lookup')} className={`btn ${adminTab === 'lookup' ? 'btn-primary' : ''}`} style={{ fontSize: '0.8rem', padding: '6px 16px' }}>照合</button>
                <button onClick={() => { setAdminTab('users'); setSelectedUserForVehicles(null); }} className={`btn ${adminTab === 'users' ? 'btn-primary' : ''}`} style={{ fontSize: '0.8rem', padding: '6px 16px' }}>ユーザー</button>
              </div>
            </div>

            {adminTab === 'vehicles' ? (
              <div className="glass" style={{ overflowX: 'auto', borderRadius: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}><th style={{ padding: '16px' }}>ユーザー</th><th style={{ padding: '16px' }}>車両</th><th style={{ padding: '16px' }}>操作</th></tr></thead>
                  <tbody>
                    {vehicles.map(v => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '16px' }}>{v.roblox_username}</td>
                        <td style={{ padding: '16px' }}>{v.year} {v.maker} {v.model} ({v.plate})</td>
                        <td style={{ padding: '16px' }}>
                          <button onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ marginRight: '8px', color: 'var(--success)' }}>承認</button>
                          <button onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ color: 'var(--error)' }}>却下</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : adminTab === 'lookup' ? (
              <div>
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="glass" style={{ width: '100%', padding: '12px', marginBottom: '24px', borderRadius: '12px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {allSearchVehicles.filter(v => v.plate.includes(searchTerm) || v.roblox_username.includes(searchTerm)).map(v => (
                    <div key={v.id} className="glass card" style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{v.roblox_username}</div>
                      <div>{v.year} {v.maker} {v.model}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 800 }}>{v.plate}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {selectedUserForVehicles ? (
                  <div>
                    <button onClick={() => setSelectedUserForVehicles(null)} style={{ marginBottom: '16px' }}><ArrowLeft size={16} /> Back</button>
                    <h3>{selectedUserForVehicles.username}'s Vehicles</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                      {allSearchVehicles.filter(v => v.owner_id === selectedUserForVehicles.id).map(v => (
                        <div key={v.id} className="glass card">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{v.year} {v.maker} {v.model}</span>
                            <StatusBadge status={v.status} />
                          </div>
                          <div style={{ fontFamily: 'monospace', fontWeight: 800, marginTop: '8px' }}>{v.plate}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <button onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ flex: 1, color: 'var(--success)' }}>承認</button>
                            <button onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ flex: 1, color: 'var(--error)' }}>却下</button>
                            <button onClick={() => handleDeleteVehicle(v.id)} style={{ color: 'var(--error)' }}><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}><th style={{ padding: '16px' }}>User</th><th style={{ padding: '16px' }}>Action</th></tr></thead>
                      <tbody>
                        {allUsers.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <td style={{ padding: '16px' }}>{u.username}</td>
                            <td style={{ padding: '16px' }}>
                              <button onClick={() => setSelectedUserForVehicles(u)} style={{ marginRight: '16px' }}>View Vehicles</button>
                              {u.id !== currentUser.id && <button onClick={() => handleUpdateRole(u.id, u.role === 'admin' ? 'user' : 'admin')}>{u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass card" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
            <h2>{editingVehicleId ? '修正' : '申請'}</h2>
            <form onSubmit={handleSubmitVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              <input type="text" placeholder="メーカー" value={formData.maker} onChange={e => setFormData({...formData, maker: e.target.value})} required className="glass" />
              <input type="text" placeholder="モデル" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required className="glass" />
              <input type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} required className="glass" />
              <input type="text" placeholder="プレート" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required className="glass" />
              <div style={{ height: '120px', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {formData.image_data ? <img src={formData.image_data} alt="p" style={{ height: '100%' }} /> : <ImageIcon />}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ position: 'absolute', inset: 0, opacity: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>{editingVehicleId ? '修正' : '申請'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
