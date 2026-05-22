const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startAnchor = `  const handleOCRFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {\r\n    const file = e.target.files?.[0];\r\n    if (file) handleAutoFillFromImage(file);\r\n  };`;

const startAnchorLF = `  const handleOCRFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {\n    const file = e.target.files?.[0];\n    if (file) handleAutoFillFromImage(file);\n  };`;

const endAnchor = `  const handleSubmitApplication = async (e: React.FormEvent) => {`;

let startIndex = content.indexOf(startAnchor);
let isLF = false;
if (startIndex === -1) {
  startIndex = content.indexOf(startAnchorLF);
  isLF = true;
}

if (startIndex === -1) {
  console.error("Could not find start anchor");
  process.exit(1);
}

const endIndex = content.indexOf(endAnchor);
if (endIndex === -1) {
  console.error("Could not find end anchor");
  process.exit(1);
}

const replacement = (isLF ? `\n\n` : `\r\n\r\n`) + `  useEffect(() => {
    if (!showBetaAutoFillModal) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleAutoFillFromImage(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showBetaAutoFillModal]);

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingVehicleId ? 'PUT' : 'POST';
    try {
      const payload = { 
        ...formData, 
        owner_id: currentUser.id, 
        is_temp_registration: registrationMode === 'temp' ? 1 : 0 
      };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditingVehicleId(null);
        setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
        fetchVehicles();
      } else {
        const err = await res.json() as any;
        alert(err.error || '車両登録に失敗しました。');
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
    }
  };` + (isLF ? `\n\n` : `\r\n\r\n`);

const before = content.slice(0, startIndex + (isLF ? startAnchorLF.length : startAnchor.length));
const after = content.slice(endIndex);

content = before + replacement + after;
fs.writeFileSync(filePath, content, 'utf8');
console.log('App.tsx syntax restored successfully!');
