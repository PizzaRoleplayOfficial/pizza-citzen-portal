import { CatalogData } from "../types";

export const fetchWikiCatalog = async (
  gameType: "gv" | "rc",
  onProgress: (msg: string) => void
): Promise<CatalogData> => {
  // 1. Fetch all pages in Category:Vehicles
  const domain = gameType === "rc" ? "rensselaer-county.fandom.com" : "greenville-wisconsin.fandom.com";
  const baseUrl = `https://${domain}/api.php`;
  const listUrl = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:Vehicles&cmlimit=500&format=json&origin=*`;
  const listRes = await fetch(listUrl);
  const listData = await listRes.json();
  const members = (listData as any)?.query?.categorymembers || [];


  const newCatalog: CatalogData = {
    carModels: {},
    carTrims: [],
    carColors: [],
  };

  const colorSet = new Set<string>();
  const trimSet = new Set<string>();

  // 2. Process in batches to avoid rate limits and UI hang
  const titles = members
    .map((m: any) => m.title)
    .filter(
      (t: string) => !t.includes("Category:") && !t.includes("Template:")
    );

  onProgress(`全 ${titles.length} 件の車両データを解析中...`);

  // Batch size for generator API
  const batchSize = 50;
  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    onProgress(`解析中: ${i} / ${titles.length} ...`);

    const genUrl = `${baseUrl}?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(
      batch.join("|")
    )}&format=json&origin=*`;
    const genRes = await fetch(genUrl);
    const genData = await genRes.json();
    const pages = (genData as any)?.query?.pages || {};


    Object.values(pages).forEach((page: any) => {
      const content = page.revisions?.[0]?.slots?.main?.["*"] || "";
      const title = page.title;

      // Simple parsing for Year/Maker/Model from title or content
      const parts = title.split(" ");
      if (parts.length >= 3) {
        const maker = parts[1];
        const model = parts.slice(2).join(" ");

        if (!newCatalog.carModels[maker]) newCatalog.carModels[maker] = [];
        if (!newCatalog.carModels[maker].includes(model)) {
          newCatalog.carModels[maker].push(model);
        }
      }

      // Extract Trims (Robust support for bullets + table columns)
      const trimsMatch = content.match(/==[^=]*(?:Trims|Trim Choices|Trim Options)[^=]*==[\s\S]*?(?=\n==|$)/i);
      if (trimsMatch) {
        const trimsSection = trimsMatch[0];
        // 1. Try bullet points
        const bulletTrims = trimsSection.match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
        if (bulletTrims) {
          bulletTrims.forEach((t: string) => {
            const cleaned = t
              .replace(/^\*\s*\[?\[?/, "")
              .replace(/\]?\]?$/, "")
              .trim();
            if (cleaned && cleaned.length < 30) trimSet.add(cleaned);
          });
        }
        // 2. Try table rows (Rensselaer County Wiki format)
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
               
             if (trimName && 
                 trimName.length > 1 && 
                 trimName.length < 30 && 
                 !/^(trim|purchase|sell|price|prices|colspan|rowspan)$/i.test(trimName) &&
                 !/^\d+$/.test(trimName) && 
                 !trimName.includes('{') && 
                 !trimName.includes('}')
             ) {
               trimSet.add(trimName);
             }
          }
        });
      }

      // Extract Colors (Robust support for bullets + table columns)
      const colorsMatch = content.match(/==[^=]*(?:Colors|Color Choices|Color Options|Stock Colors)[^=]*==[\s\S]*?(?=\n==|$)/i);
      if (colorsMatch) {
        const colorsSection = colorsMatch[0];
        // 1. Try bullet points
        const bulletColors = colorsSection.match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
        if (bulletColors) {
          bulletColors.forEach((c: string) => {
            const cleaned = c
              .replace(/^\*\s*\[?\[?/, "")
              .replace(/\]?\]?$/, "")
              .trim();
            if (cleaned && cleaned.length < 40) colorSet.add(cleaned);
          });
        }
        // 2. Try table rows (Rensselaer County Wiki format)
        const colorLines = colorsSection.split('\n');
        colorLines.forEach(line => {
          const trimmed = line.trim();
          if ((trimmed.startsWith('!') || trimmed.startsWith('|')) && 
              !trimmed.startsWith('|-') && 
              !trimmed.startsWith('|}') && 
              !trimmed.startsWith('{|')
          ) {
             let colorName = trimmed.substring(1).trim();
             colorName = colorName
               .replace(/'''+/g, '')
               .replace(/\[\[|\]\]/g, '')
               .replace(/<\/?[^>]+(>|$)/g, "")
               .trim();
               
             if (colorName && 
                 colorName.length > 1 && 
                 colorName.length < 40 && 
                 !colorName.toLowerCase().includes('color') && 
                 !colorName.includes('{') && 
                 !colorName.includes('}')
             ) {
               colorSet.add(colorName);
             }
          }
        });
      }
    });
  }

  newCatalog.carTrims = Array.from(trimSet).sort();
  newCatalog.carColors = Array.from(colorSet).sort();

  const sortedModels: Record<string, string[]> = {};
  Object.keys(newCatalog.carModels)
    .sort()
    .forEach((maker) => {
      sortedModels[maker] = newCatalog.carModels[maker].sort();
    });
  newCatalog.carModels = sortedModels;

  return newCatalog;
};

export const saveCatalogToDatabase = async (
  catalog: CatalogData,
  gameType: "gv" | "rc"
): Promise<boolean> => {
  const saveRes = await fetch(`/api/catalog?gameType=${gameType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(catalog),
  });
  return saveRes.ok;
};
