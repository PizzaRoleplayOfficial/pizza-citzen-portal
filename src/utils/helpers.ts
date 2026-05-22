export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // High compression
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const parseUTCDate = (dateString?: string | null): Date => {
  if (!dateString) return new Date(0);
  try {
    if (dateString.includes('T') && (dateString.endsWith('Z') || dateString.includes('+'))) {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const isoString = dateString.replace(' ', 'T') + (dateString.endsWith('Z') ? '' : 'Z');
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      const fallback = new Date(dateString);
      return isNaN(fallback.getTime()) ? new Date(0) : fallback;
    }
    return date;
  } catch (e) {
    return new Date(0);
  }
};

export const formatDate = (dateString?: string) => {
  if (!dateString) return '---';
  try {
    const parsed = parseUTCDate(dateString);
    if (parsed.getTime() === 0) return dateString;
    return parsed.toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};