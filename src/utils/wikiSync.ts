import { CatalogData } from "../types";

export const fetchWikiCatalog = async (
  onProgress: (msg: string) => void
): Promise<CatalogData> => {
  // 1. Fetch all pages in Category:Vehicles
  const baseUrl = "https://greenville-wisconsin.fandom.com/api.php";
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

      // Extract Trims
      const trimsPart = content.match(/===?\s*Trims\s*===?([\s\S]*?)(?:==|$)/i);
      if (trimsPart) {
        const bulletTrims = trimsPart[1].match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
        bulletTrims?.forEach((t: string) => {
          const cleaned = t
            .replace(/^\*\s*\[?\[?/, "")
            .replace(/\]?\]?$/, "")
            .trim();
          if (cleaned && cleaned.length < 30) trimSet.add(cleaned);
        });
      }

      // Extract Colors
      const colorsPart = content.match(/===?\s*Colors\s*===?([\s\S]*?)(?:==|$)/i);
      if (colorsPart) {
        const bulletColors = colorsPart[1].match(/\*\s*\[?\[?([^\]\n|]+)\]?\]?/g);
        bulletColors?.forEach((c: string) => {
          const cleaned = c
            .replace(/^\*\s*\[?\[?/, "")
            .replace(/\]?\]?$/, "")
            .trim();
          if (cleaned && cleaned.length < 40) colorSet.add(cleaned);
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

export const saveCatalogToDatabase = async (catalog: CatalogData): Promise<boolean> => {
  const saveRes = await fetch("/api/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(catalog),
  });
  return saveRes.ok;
};
