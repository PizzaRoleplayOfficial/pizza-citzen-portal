// Shared utility: generate a colored initials SVG data URL as avatar fallback
// Used when Discord CDN images fail to load on mobile (CORS/User-Agent restrictions)

export const getAvatarFallbackSvg = (name: string): string => {
  const initial = (name || '?')[0].toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="16" fill="hsl(${hue},60%,40%)"/><text x="64" y="64" dominant-baseline="central" text-anchor="middle" font-size="60" font-family="sans-serif" font-weight="bold" fill="white">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

export const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, name: string) => {
  const img = e.currentTarget;
  img.onerror = null; // prevent infinite loop

  const src = img.src;
  const match = src.match(/\/avatars\/(\d+)\//);

  if (match && match[1]) {
    const userId = match[1];
    
    // Set fallback first (temporary visual fix)
    img.src = getAvatarFallbackSvg(name);

    fetch(`/api/users/refresh-avatar?userId=${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to refresh');
        return res.json();
      })
      .then((data: any) => {
        if (data && data.avatar) {
          img.src = data.avatar;
        }
      })
      .catch(() => {
        // Fallback is already set
      });
  } else {
    img.src = getAvatarFallbackSvg(name);
  }
};

