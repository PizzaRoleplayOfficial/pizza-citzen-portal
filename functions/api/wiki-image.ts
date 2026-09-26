const JSON_HEADERS = { 'Content-Type': 'application/json' };

type WikiResult = {
  imageUrl: string | null;
  trims: string[];
  colors: string[];
};

const extractTrims = (content: string): string[] => {
  const trims = new Set<string>();
  
  // 1. Look for <gallery> tags, but skip miscellaneous / photo / leak galleries
  const galleryRegex = /<gallery[^>]*>([\s\S]*?)<\/gallery>/gi;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = galleryRegex.exec(content)) !== null) {
    const startPos = gMatch.index;
    const precedingText = content.substring(Math.max(0, startPos - 120), startPos).toLowerCase();
    if (precedingText.includes('miscellaneous') || precedingText.includes('leak') || precedingText.includes('no longer')) {
      continue;
    }
    const lines = gMatch[1].split('\n');
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length > 1) {
        let trim = parts[parts.length - 1].trim(); 
        trim = trim.replace(/<\/?[^>]+(>|$)/g, "").trim();
        // Remove drivetrain suffix (FWD/AWD/RWD/4WD/4x4)
        trim = trim.replace(/\s+(?:FWD|AWD|RWD|4WD|4x4)\s*$/i, '').trim();

        // Strict filtering against photo angles, descriptions, and file markup
        if (trim && 
            trim.length > 1 && 
            trim.length < 30 && 
            !trim.includes('[[') && 
            !trim.startsWith('!') && 
            !trim.includes('$') &&
            !/(?:^|\s|\()(?:front|rear|side|top|bottom|interior|inside|engine|logo|badge|dashboard|door|wheel|rim|rims|discord|trello|leak|view)\b/i.test(trim) &&
            !/design|facelift|vs|old|new|comparison/i.test(trim)
        ) {
          trims.add(trim);
        }
      }
    });
  }

  // 2. Look for specialized Infobox parameters like '| Trims = ...' if present
  const trimParam = content.match(/\|\s*trims?\s*=\s*([^|\n}]+)/i);
  if (trimParam && trimParam[1]) {
    const list = trimParam[1].split(/[,/·]/);
    list.forEach(item => {
      const cleaned = item.replace(/\[\[|\]\]/g, '').trim();
      if (cleaned && cleaned.length < 30 && !cleaned.includes('$')) trims.add(cleaned);
    });
  }

  // 3. Fallback: Parse table rows in the ==Trims== section (must match single-line section header)
  const trimsMatch = content.match(/(?:^|\n)==+\s*(?:Trims|Trim\s+Choices|Trim\s+Options)\s*==+[\t ]*\n([\s\S]*?)(?=\n==+|$)/i);
  if (trimsMatch && trimsMatch[1]) {
    const trimsSection = trimsMatch[1];
    const trimLines = trimsSection.split('\n');
    trimLines.forEach(line => {
      const trimmed = line.trim();
      if ((trimmed.startsWith('!') || trimmed.startsWith('|')) && 
          !trimmed.startsWith('|-') && 
          !trimmed.startsWith('|}') && 
          !trimmed.startsWith('{|')
      ) {
         let cleanedLine = trimmed
           .replace(/^[\!\|]/, '')
           .replace(/\[\[File:[^\]]+\]\]/gi, '')
           .replace(/\[\[Category:[^\]]+\]\]/gi, '');
           
         const parts = cleanedLine.split('|');
         let trimName = parts[parts.length - 1].trim();
         
         trimName = trimName
           .replace(/'''+/g, '')
           .replace(/\[\[|\]\]/g, '')
           .replace(/<\/?[^>]+(>|$)/g, "")
           .replace(/^\d+px\]?\]?/g, "")
           .replace(/\s+(?:FWD|AWD|RWD|4WD|4x4)\s*$/i, '')
           .trim();
           
         if (trimName && 
              trimName.length > 1 && 
              trimName.length < 30 && 
              !trimName.includes('$') &&
              !trimName.startsWith('!') &&
              !/^(trim|purchase|sell|price|prices|colspan|rowspan|discord|leak|leaks|msrp|n\/a|—|-|default rims|rims)$/i.test(trimName) &&
              !/(?:price|leak|sell|purchase|\$|discord|scope=|class=|style=|rowspan|colspan)/i.test(trimName) &&
              !/(?:^|\s|\()(?:front|rear|side|top|bottom|interior|inside|engine|logo|badge|dashboard|door|wheel|rim|rims|discord|trello|leak|view)\b/i.test(trimName) &&
              !/^\d+(?:,\d+)*$/.test(trimName) &&
              !/^\d+$/.test(trimName) && 
              !trimName.includes('{') && 
              !trimName.includes('}') &&
              !/file:|image:/i.test(trimName)
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
  
  // Section header must match on a single line!
  const colorsMatch = content.match(/(?:^|\n)==+\s*(?:Stock\s+Colors|Color\s+Choices|Color\s+Options|Colors)\s*==+[\t ]*\n([\s\S]*?)(?=\n==+|$)/i);
  if (colorsMatch && colorsMatch[1]) {
    const colorsSection = colorsMatch[1];
    
    // 1. Bullet points
    const bulletColors = colorsSection.match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
    if (bulletColors) {
      bulletColors.forEach((c: string) => {
        const cleaned = c.replace(/^\*\s*\[?\[?/, '').replace(/\]?\]?$/, '').trim();
        if (cleaned && cleaned.length > 1 && cleaned.length < 40 && !cleaned.includes('$') && !/^(color|colors|price|\d+)/i.test(cleaned)) {
          colors.add(cleaned);
        }
      });
    }

    // 2. Table rows
    const colorLines = colorsSection.split('\n');
    colorLines.forEach(line => {
       const trimmed = line.trim();
       if ((trimmed.startsWith('|') || trimmed.startsWith('!')) && 
           !trimmed.startsWith('|-') && 
           !trimmed.startsWith('|}') && 
           !trimmed.startsWith('{|')
       ) {
           const cleaned = trimmed.replace(/^[\!\|]/, '').trim();
           const parts = cleaned.split('|');
           let color = parts[parts.length - 1].trim();
           color = color
             .replace(/'''+/g, '') 
             .replace(/\[\[|\]\]/g, '') 
             .replace(/<\/?[^>]+(>|$)/g, "") 
             .replace(/^\d+px\]?\]?/g, "")
             .trim();
             
           if (color && 
               color.length > 1 && 
               color.length < 40 && 
               !color.includes('$') &&
               !/^(color|colors|default rims|rims|trim|trims|purchase|sell|price|scope=|class=|style=|rowspan|colspan)/i.test(color) &&
               !/(?:purchase|sell|price|\$|scope=|class=|style=|rowspan|colspan)/i.test(color) &&
               !/file:|image:/i.test(color) &&
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

