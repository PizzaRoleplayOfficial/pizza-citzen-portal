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
  img.src = getAvatarFallbackSvg(name);
};
