const JSON_HEADERS = { 'Content-Type': 'application/json' };

type WikiResult = {
  imageUrl: string | null;
  trims: string[];
  colors: string[];
};

const extractTrims = (content: string): string[] => {
  const trims = new Set<string>();
  
  // 1. Look for <gallery> tags which often list trims as labels
  const galleryMatches = content.match(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi);
  if (galleryMatches) {
    galleryMatches.forEach(gallery => {
      const lines = gallery.split('\n');
      lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length > 1) {
          let trim = parts[parts.length - 1].trim(); 
          // Remove any stray HTML/XML tags
          trim = trim.replace(/<\/?[^>]+(>|$)/g, "").trim();
          // 末尾の駆動方式（FWD/AWD/RWD/4WDなど）を除去してゲーム内での重複表示を防止する
          trim = trim.replace(/\s+(?:FWD|AWD|RWD|4WD|4x4)\s*$/i, '').trim();

          // Basic filtering to avoid junk/descriptions
          if (trim && 
              trim.length > 1 && 
              trim.length < 30 && 
              !trim.includes('[[') && 
              !/^(Front|Rear|Side|Top|Bottom|Interior|Inside|Engine|Logo|Badge|Dashboard|Door|Wheel|Rim|Rim\(s\)|Rim \d+)$/i.test(trim) &&
              !/design|facelift|vs|old|new|comparison/i.test(trim)
          ) {
            trims.add(trim);
          }
        }
      });
    });
  }

  // 2. Look for specialized Infobox parameters like '| Trims = ...' if present
  const trimParam = content.match(/\|\s*trims?\s*=\s*([^|\n}]+)/i);
  if (trimParam && trimParam[1]) {
    const list = trimParam[1].split(/[,/·]/);
    list.forEach(item => {
      const cleaned = item.replace(/\[\[|\]\]/g, '').trim();
      if (cleaned && cleaned.length < 30) trims.add(cleaned);
    });
  }

  // 3. Fallback: Parse table rows in the ==Trims== section (robust for RC wiki)
  const trimsMatch = content.match(/==[^=]*(?:Trims|Trim Choices|Trim Options)[^=]*==[\s\S]*?(?=\n==|$)/i);
  if (trimsMatch) {
    const trimsSection = trimsMatch[0];
    const trimLines = trimsSection.split('\n');
    trimLines.forEach(line => {
      const trimmed = line.trim();
      if ((trimmed.startsWith('!') || trimmed.startsWith('|')) && 
          !trimmed.startsWith('|-') && 
          !trimmed.startsWith('|}') && 
          !trimmed.startsWith('{|')
      ) {
         let cleanedLine = trimmed
           .replace(/\[\[File:[^\]]+\]\]/gi, '')
           .replace(/\[\[Category:[^\]]+\]\]/gi, '');
           
         const parts = cleanedLine.split('|');
         let trimName = parts[parts.length - 1].trim();
         
         trimName = trimName
           .replace(/'''+/g, '')
           .replace(/\[\[|\]\]/g, '')
           .replace(/<\/?[^>]+(>|$)/g, "")
           .replace(/^\d+px\]?\]?/g, "")
           .trim();
           
         // 末尾の駆動方式（FWD/AWD/RWD/4WDなど）を除去してゲーム内での重複表示を防止する
         trimName = trimName.replace(/\s+(?:FWD|AWD|RWD|4WD|4x4)\s*$/i, '').trim();
           
         if (trimName && 
              trimName.length > 1 && 
              trimName.length < 30 && 
              !trimName.includes('$') &&
              !trimName.startsWith('!') &&
              !/^(trim|purchase|sell|price|prices|colspan|rowspan|discord|leak|leaks|msrp|n\/a|—|-)$/i.test(trimName) &&
              !/(?:price|leak|sell|purchase|\$|discord)/i.test(trimName) &&
              !/^\d+(?:,\d+)*$/.test(trimName) &&
              !/^\d+$/.test(trimName) && 
              !trimName.includes('{') && 
              !trimName.includes('}')
          ) {
            trims.add(trimName);
          }
      }
    });
  }

  return Array.from(trims);
};

const extractColors = (content: string): string[] => {
  const colors = new Set<string>();
  
  // Try 1: General match for color section
  const colorsMatch = content.match(/==[^=]*(?:Colors|Color Choices|Color Options|Stock Colors)[^=]*==[\s\S]*?(?=\n==|$)/i);
  if (colorsMatch) {
    const colorsSection = colorsMatch[0];
    const colorLines = colorsSection.split('\n');
    colorLines.forEach(line => {
       const trimmed = line.trim();
       if ((trimmed.startsWith('|') || trimmed.startsWith('!')) && 
           !trimmed.startsWith('|-') && 
           !trimmed.startsWith('|}') && 
           !trimmed.startsWith('{|')
       ) {
           let color = trimmed.substring(1).trim();
           color = color
             .replace(/'''+/g, '') 
             .replace(/\[\[|\]\]/g, '') 
             .replace(/<\/?[^>]+(>|$)/g, "") 
             .trim();
             
           if (color && 
               color.length > 1 && 
               color.length < 40 && 
               !color.toLowerCase().includes('color') && 
               !color.includes('{') && 
               !color.includes('}')
           ) {
               colors.add(color);
           }
       }
    });
  }
  
  return Array.from(colors);
};

const resolveFileUrl = async (fileName: string, gameType: 'gv' | 'rc'): Promise<string | null> => {
  try {
    const host = gameType === 'rc' ? 'rensselaer-county.fandom.com' : 'greenville-wisconsin.fandom.com';
    const url = new URL(`https://${host}/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', `File:${fileName.trim()}`);
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 PizzaCitizenPortal/1.0', 'Accept': 'application/json' },
      cf: { cacheEverything: true, cacheTtl: 3600 } as any
    });
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.imageinfo?.[0]?.url || null;
  } catch (e) {
    return null;
  }
};

const fetchWikiData = async (title: string, targetTrim?: string | null, gameType: 'gv' | 'rc' = 'gv'): Promise<WikiResult> => {
  const host = gameType === 'rc' ? 'rensselaer-county.fandom.com' : 'greenville-wisconsin.fandom.com';
  const fandomUrl = new URL(`https://${host}/api.php`);
  fandomUrl.searchParams.set('action', 'query');
  fandomUrl.searchParams.set('prop', 'pageimages|revisions');
  fandomUrl.searchParams.set('titles', title);
  fandomUrl.searchParams.set('format', 'json');
  fandomUrl.searchParams.set('pithumbsize', '600');
  fandomUrl.searchParams.set('rvprop', 'content');
  fandomUrl.searchParams.set('rvslots', 'main');
  fandomUrl.searchParams.set('origin', '*');

  const res = await fetch(fandomUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 PizzaCitizenPortal/1.0',
      'Accept': 'application/json'
    },
    cf: { cacheEverything: true, cacheTtl: 600 } as any
  });

  if (!res.ok) return { imageUrl: null, trims: [], colors: [] };

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { return { imageUrl: null, trims: [], colors: [] }; }

  const pages = data?.query?.pages;
  if (!pages) return { imageUrl: null, trims: [], colors: [] };

  const pageId = Object.keys(pages)[0];
  if (pageId === '-1') return { imageUrl: null, trims: [], colors: [] };

  const page = pages[pageId];
  let imageUrl = page.thumbnail?.source ?? null;
  const content = page.revisions?.[0]?.slots?.main?.['*'] ?? '';

  if (content && targetTrim) {
    // Try to find a matching image in <gallery>
    const galleryMatches = content.match(/<gallery[^>]*>([\s\S]*?)<\/gallery>/gi);
    if (galleryMatches) {
      for (const gallery of galleryMatches) {
        const lines = gallery.split('\n');
        for (const line of lines) {
          const parts = line.split('|');
          if (parts.length > 1) {
            let trimMatch = parts[parts.length - 1].trim().replace(/<\/?[^>]+(>|$)/g, ""); // Strip HTML
            let filePart = parts[0].trim();
            // If the label matches the requested trim (case-insensitive substring)
            if (trimMatch.toLowerCase().includes(targetTrim.toLowerCase())) {
              const specificUrl = await resolveFileUrl(filePart, gameType);
              if (specificUrl) {
                imageUrl = specificUrl;
                break;
              }
            }
          }
        }
        // Break outer loop if an image was found and resolved
        if (imageUrl && imageUrl !== page.thumbnail?.source) break;
      }
    }
  }

  const trims = content ? extractTrims(content) : [];
  const colors = content ? extractColors(content) : [];

  return { imageUrl, trims, colors };
};

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const targetTrim = url.searchParams.get('trim');
  const gameType = (url.searchParams.get('gameType') || 'gv') as 'gv' | 'rc';

  if (!query) {
    return new Response(JSON.stringify({ imageUrl: null, trims: [], colors: [] }), { status: 200, headers: JSON_HEADERS });
  }

  try {
    // Try 1: Full query
    let result = await fetchWikiData(query, targetTrim, gameType);

    // Try 2: Fallback without leading year
    if (!result.imageUrl && result.trims.length === 0 && result.colors.length === 0) {
      const withoutYear = query.replace(/^\d{4}\s+/, '');
      if (withoutYear !== query) {
        const fallbackResult = await fetchWikiData(withoutYear, targetTrim, gameType);
        if (fallbackResult.imageUrl || fallbackResult.trims.length > 0 || fallbackResult.colors.length > 0) {
          result = fallbackResult;
        }
      }
    }

    return new Response(JSON.stringify(result), { status: 200, headers: JSON_HEADERS });

  } catch (error: any) {
    console.error('wiki-image fetch failed:', error.message);
    return new Response(JSON.stringify({ imageUrl: null, trims: [], colors: [] }), { status: 200, headers: JSON_HEADERS });
  }
};

