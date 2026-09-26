import { CatalogData } from "../types";

// Known multi-word and single-word vehicle brands for accurate matching
const KNOWN_BRANDS = [
  'Fox Mountain Motors', 'Terrain Traveller', 'TerrainTraveller', 'Sir Rodgers',
  'Alfa Romeo', 'Aston Martin', 'Land Rover', 'Mercedes-Benz',
  'APEX', 'Abarth', 'Acadia', 'Agner', 'Aikawa', 'Airbus', 'Andre', 'Armstrong',
  'Arrow', 'Auburn', 'Audi', 'Autowerk', 'Avanta', 'BITSY', 'BKM', 'BMW', 'BTF',
  'Bandit', 'Barchetta', 'Bayro', 'Beam', 'Bellco', 'Bob', 'Bovine', 'Brawnson',
  'BullHorn', 'Caline', 'Caseus', 'Celestial', 'Century', 'Cesko', 'Chevlon',
  'Chiara', 'Chryslus', 'Cobalt', 'Colin', 'Colt', 'Combi', 'Cratus', 'DIRECT',
  'DOGG', 'DejaVu', 'DeliverMaster', 'Durable', 'Durant', 'Eezee', 'Elektrisk',
  'Elgrand', 'Elysion', 'Explorer', 'Falcon', 'Ferdinand', 'Fiat', 'Ford',
  'GIGA', 'Globe', 'Honda', 'Horlock', 'Hyundai', 'Idea', 'Jaguar', 'Jupiter',
  'Kenworth', 'Lancia', 'Lawn-King', 'Leland', 'Lexus', 'Lincoln', 'Lotus',
  'Maranello', 'Marlin', 'Mauntley', 'Maverick', 'Mayflower', 'Mazuku',
  'Meisterklassen', 'Mitsubishi', 'Mizushima', 'N3XT', 'NVNA', 'NVNAsport',
  'Navara', 'Newcar', 'Nissan', 'Normouth', 'Oakura', 'Oland', 'Origin',
  'OverHill', 'Overland', 'Pagani', 'Panini', 'Piranha', 'Polar', 'Porsche',
  'Pumpkin', 'RELOAD', 'Ramsey', 'Renault', 'Revver', 'Rokuta', 'Romalpha',
  'SAAB', 'Saleen', 'Sentinel', 'Shizuoka', 'Si', 'Silhouette', 'Simple',
  'Skane', 'Strugatti', 'Stuttgart', 'Suki', 'Sumo', 'Sunray', 'Surrey',
  'Swagwagon', 'TONY', 'Takeo', 'Tuscani', 'VSV', 'Valley', 'Vellfire',
  'Viking', 'Vision', 'Volkswagen', 'Volzhsky', 'WSP', 'Wave', 'WeGo',
  'Western', 'Wolfsburg', 'Wynne', 'Zephyr'
];

// Sort brands by length descending so longer/multi-word names match first
const SORTED_BRANDS = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);

const IGNORE_TITLES = new Set([
  'Admin Vehicles', 'Beater Variants', 'Bikes', 'Car Removals', 'Celestruck',
  'Diesel-Electric Locomotive', 'Fictional Vehicles', 'Gamepass',
  'Greenville/Limited Vehicle Release History', 'High-speed Train', 'Ivy Accessories',
  'Job Application', 'Job Vehicles', 'Licensed Vehicles', 'List of all vehicles in Greenville',
  'Mega Cart v2.0', 'Prop Cars', 'Trailers', 'Trains', 'Unidentified Vehicles',
  'Vehicle Brands', 'Vehicle Lighting', 'Vehicle/Beta V2', 'Vehicle/License Plates',
  'Wheelchair', 'Alberts cool van'
]);

export const fetchWikiCatalog = async (
  gameType: "gv" | "rc",
  onProgress: (msg: string, progress?: number) => void
): Promise<CatalogData> => {
  const domain = gameType === "rc" ? "rensselaer-county.fandom.com" : "greenville-wisconsin.fandom.com";
  const baseUrl = `https://${domain}/api.php`;

  onProgress("Wikiから全車両の一覧を取得中...", 5);

  // 1. Fetch ALL pages in Category:Vehicles with cmnamespace=0 (articles only) using cmcontinue pagination loop
  const allMembers: { title: string }[] = [];
  let cmcontinue: string | null = null;

  while (true) {
    let listUrl = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:Vehicles&cmnamespace=0&cmlimit=500&format=json&origin=*`;
    if (cmcontinue) {
      listUrl += `&cmcontinue=${encodeURIComponent(cmcontinue)}`;
    }
    const listRes = await fetch(listUrl);
    if (!listRes.ok) break;
    const listData = await listRes.json();
    const members = (listData as any)?.query?.categorymembers || [];
    allMembers.push(...members);

    const cont = (listData as any)?.continue;
    if (cont && cont.cmcontinue) {
      cmcontinue = cont.cmcontinue;
    } else {
      break;
    }
  }

  // Filter out non-vehicle / meta titles
  const titles = allMembers
    .map((m: any) => m.title)
    .filter((t: string) => 
      t && 
      !IGNORE_TITLES.has(t) &&
      !t.startsWith("Category:") &&
      !t.startsWith("Template:") &&
      !t.startsWith("Vehicle/") &&
      !t.startsWith("List of") &&
      !t.toLowerCase().startsWith("user blog:") &&
      !t.toLowerCase().startsWith("blog:")
    );

  onProgress(`全 ${titles.length} 件の車両データを解析中...`, 15);

  const newCatalog: CatalogData = {
    carModels: {},
    carTrims: [],
    carColors: [],
  };

  const colorSet = new Set<string>();
  const trimSet = new Set<string>();

  // 2. Process in batches with concurrent requests for high performance
  const batchSize = 50;

  for (let i = 0; i < titles.length; i += batchSize * 3) {
    const chunkPromises = [];
    for (let c = 0; c < 3 && i + c * batchSize < titles.length; c++) {
      const start = i + c * batchSize;
      const batch = titles.slice(start, start + batchSize);
      const genUrl = `${baseUrl}?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(
        batch.join("|")
      )}&format=json&origin=*`;

      chunkPromises.push(
        fetch(genUrl)
          .then(r => r.json())
          .then(data => (data as any)?.query?.pages || {})
          .catch(() => ({}))
      );
    }

    const currentIdx = Math.min(i + batchSize * 3, titles.length);
    const progressPercent = Math.min(75, 15 + Math.round((currentIdx / titles.length) * 60));
    onProgress(`解析中: ${currentIdx} / ${titles.length} 件...`, progressPercent);

    const results = await Promise.all(chunkPromises);

    for (const pages of results) {
      Object.values(pages).forEach((page: any) => {
        const content = page.revisions?.[0]?.slots?.main?.["*"] || "";
        const title = page.title || "";

        // Parse Maker and Model
        const cleanTitle = title.replace(/^(?:\d{4}(?:-\d{4})?|20[0-9X]{2})\s+/, "").trim();
        let matchedMaker: string | null = null;
        let matchedModel: string | null = null;

        for (const brand of SORTED_BRANDS) {
          if (cleanTitle.toLowerCase().startsWith(brand.toLowerCase())) {
            const rest = cleanTitle.slice(brand.length).trim();
            if (!rest || cleanTitle[brand.length] === ' ' || cleanTitle[brand.length] === '-') {
              matchedMaker = brand;
              matchedModel = rest;
              break;
            }
          }
        }

        if (!matchedMaker) {
          const parts = cleanTitle.split(" ");
          matchedMaker = parts[0];
          matchedModel = parts.slice(1).join(" ") || parts[0];
        }

        matchedMaker = matchedMaker.trim();
        matchedModel = (matchedModel || matchedMaker).trim();

        if (matchedMaker && !matchedMaker.toLowerCase().startsWith("blog:") && !matchedMaker.toLowerCase().startsWith("user")) {
          if (!newCatalog.carModels[matchedMaker]) newCatalog.carModels[matchedMaker] = [];
          if (matchedModel && !newCatalog.carModels[matchedMaker].includes(matchedModel)) {
            newCatalog.carModels[matchedMaker].push(matchedModel);
          }
        }

        // Extract Trims
        const trimsMatch = content.match(/==[^=]*(?:Trims|Trim Choices|Trim Options)[^=]*==[\s\S]*?(?=\n==|$)/i);
        if (trimsMatch) {
          const trimsSection = trimsMatch[0];
          // 1. Bullet points
          const bulletTrims = trimsSection.match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
          if (bulletTrims) {
            bulletTrims.forEach((t: string) => {
              const cleaned = t
                .replace(/^\*\s*\[?\[?/, "")
                .replace(/\]?\]?$/, "")
                .replace(/^[/\+\-]\s*/, "")
                .trim();
              if (cleaned && cleaned.length < 30 && !cleaned.includes("$") && !/^(price|trim|buy|sell)/i.test(cleaned)) {
                trimSet.add(cleaned);
              }
            });
          }
          // 2. Table rows
          const trimLines = trimsSection.split("\n");
          trimLines.forEach(line => {
            const trimmed = line.trim();
            if ((trimmed.startsWith("!") || trimmed.startsWith("|")) && 
                !trimmed.startsWith("|-") && 
                !trimmed.startsWith("|}") && 
                !trimmed.startsWith("{|")
            ) {
              const cleanedLine = trimmed
                .replace(/\[\[File:[^\]]+\]\]/gi, "")
                .replace(/\[\[Category:[^\]]+\]\]/gi, "");

              const parts = cleanedLine.split("|");
              let trimName = parts[parts.length - 1].trim();

              trimName = trimName
                .replace(/'''+/g, "")
                .replace(/\[\[|\]\]/g, "")
                .replace(/<\/?[^>]+(>|$)/g, "")
                .replace(/^\d+px\]?\]?/g, "")
                .replace(/^[/\+\-]\s*/, "")
                .trim();

              // Remove drivetrain suffix (FWD/AWD/RWD/4WD/4x4)
              trimName = trimName.replace(/\s+(?:FWD|AWD|RWD|4WD|4x4)\s*$/i, "").trim();

              if (trimName && 
                  trimName.length > 1 && 
                  trimName.length < 30 && 
                  !trimName.includes("$") &&
                  !trimName.startsWith("!") &&
                  !/^(trim|purchase|sell|price|prices|colspan|rowspan|discord|leak|leaks|msrp|n\/a|—|-)$/i.test(trimName) &&
                  !/(?:price|leak|sell|purchase|\$|discord)/i.test(trimName) &&
                  !/^\d+(?:,\d+)*$/.test(trimName) &&
                  !/^\d+$/.test(trimName) && 
                  !trimName.includes("{") && 
                  !trimName.includes("}")
              ) {
                trimSet.add(trimName);
              }
            }
          });
        }

        // Extract Colors
        const colorsMatch = content.match(/==[^=]*(?:Stock\s+Colors|Color Choices|Color Options|Colors)[^=]*==[\s\S]*?(?=\n==|$)/i);
        if (colorsMatch) {
          const colorsSection = colorsMatch[0];
          // 1. Bullet points
          const bulletColors = colorsSection.match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
          if (bulletColors) {
            bulletColors.forEach((c: string) => {
              const cleaned = c
                .replace(/^\*\s*\[?\[?|\]?\]?$/, "")
                .trim();
              if (cleaned && cleaned.length < 40 && !cleaned.includes("$") && !/^(color|price|\d+)/i.test(cleaned)) {
                colorSet.add(cleaned);
              }
            });
          }
          // 2. Table rows
          const colorLines = colorsSection.split("\n");
          colorLines.forEach(line => {
            const trimmed = line.trim();
            if ((trimmed.startsWith("!") || trimmed.startsWith("|")) && 
                !trimmed.startsWith("|-") && 
                !trimmed.startsWith("|}") && 
                !trimmed.startsWith("{|")
            ) {
              let colorName = trimmed.replace(/^[!|]+/, "").trim();
              colorName = colorName
                .replace(/'''+/g, "")
                .replace(/\[\[|\]\]/g, "")
                .replace(/<\/?[^>]+(>|$)/g, "")
                .trim();

              if (colorName && 
                  colorName.length > 1 && 
                  colorName.length < 40 && 
                  !colorName.toLowerCase().includes("color") && 
                  !colorName.includes("$") &&
                  !colorName.includes("{") && 
                  !colorName.includes("}") &&
                  !/^\d/.test(colorName) &&
                  !["unknown", "none", "—", "-"].includes(colorName.toLowerCase())
              ) {
                colorSet.add(colorName);
              }
            }
          });
        }
      });
    }
  }

  // Cap trims and colors to most useful items to keep payload compact and well within D1 limits
  newCatalog.carTrims = Array.from(trimSet).sort().slice(0, 200);
  newCatalog.carColors = Array.from(colorSet).sort().slice(0, 200);

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
