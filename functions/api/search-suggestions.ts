// API for retrieving search autocomplete suggestions (Users & Keywords) with Japanese Kana/Romaji fuzzy matching
// Path: functions/api/search-suggestions.ts

const romajiToKanaMap: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', tsu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', nn: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ'
};

const kanaToRomajiMap: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'zo': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo'
};

function toHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
}

function romajiToHiragana(str: string): string {
  let res = str.toLowerCase();
  // Sort keys by length descending to match longer strings first
  const keys = Object.keys(romajiToKanaMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const regex = new RegExp(key, 'g');
    res = res.replace(regex, romajiToKanaMap[key]);
  }
  // Fallback for single 'n'
  res = res.replace(/n/g, 'ん');
  return res;
}

function kanaToRomaji(str: string): string {
  let res = str;
  // Sort keys by length descending to match double characters first
  const keys = Object.keys(kanaToRomajiMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const regex = new RegExp(key, 'g');
    res = res.replace(regex, kanaToRomajiMap[key]);
  }
  return res;
}

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';

  if (!query || query.trim().length < 1) {
    return new Response(JSON.stringify({ users: [], keywords: [] }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  }

  try {
    const db = env.D1_DB;
    const trimmed = query.trim();

    // Generate query variations for fuzzy Japanese search
    const queryVariants = new Set<string>();
    queryVariants.add(trimmed);

    const hira = toHiragana(trimmed);
    const kata = toKatakana(trimmed);
    const romajiFromKana = kanaToRomaji(hira);
    const hiraFromRomaji = romajiToHiragana(trimmed);
    const kataFromRomaji = toKatakana(hiraFromRomaji);

    queryVariants.add(hira);
    queryVariants.add(kata);
    queryVariants.add(romajiFromKana);
    queryVariants.add(hiraFromRomaji);
    queryVariants.add(kataFromRomaji);

    // Remove empty variations
    const cleanVariants = Array.from(queryVariants).filter(v => v.length > 0);

    // 1. Search matching users (citizens) using OR conditions for each variant
    const userConditions: string[] = [];
    const userBinds: any[] = [];
    for (const variant of cleanVariants) {
      userConditions.push("username LIKE ?");
      userBinds.push(`%${variant}%`);
      userConditions.push("roblox_username LIKE ?");
      userBinds.push(`%${variant}%`);
    }

    const userQuery = `SELECT id, username, roblox_username, avatar FROM users WHERE ${userConditions.join(" OR ")} LIMIT 5`;
    const { results: users } = await db.prepare(userQuery).bind(...userBinds).all();

    // 2. Search matching posts to suggest keywords/tags
    const postConditions: string[] = [];
    const postBinds: any[] = [];
    for (const variant of cleanVariants) {
      postConditions.push("content LIKE ?");
      postBinds.push(`%${variant}%`);
    }

    const postQuery = `SELECT content FROM timeline_posts WHERE ${postConditions.join(" OR ")} LIMIT 10`;
    const { results: posts } = await db.prepare(postQuery).bind(...postBinds).all();

    // Extract suggested search terms from matching posts:
    const keywordsSet = new Set<string>();
    
    // Always include the query itself as the first candidate
    keywordsSet.add(trimmed);

    for (const post of posts as any[]) {
      // Find hashtags in content
      const hashtags = post.content.match(/#[^\s#]+/g);
      if (hashtags) {
        for (const tag of hashtags) {
          const lowerTag = tag.toLowerCase();
          const matchesVariant = cleanVariants.some(v => lowerTag.includes(v.toLowerCase()));
          if (matchesVariant) {
            keywordsSet.add(tag);
          }
        }
      }
      
      // Extract short sentences/phrases (under 25 chars) containing any search variant
      const sentences = post.content.split(/[。\n]/);
      for (const s of sentences) {
        const trimmedSentence = s.trim();
        const lowerSentence = trimmedSentence.toLowerCase();
        
        const matchesVariant = cleanVariants.some(v => lowerSentence.includes(v.toLowerCase()));
        if (matchesVariant && trimmedSentence.length > trimmed.length && trimmedSentence.length < 25) {
          keywordsSet.add(trimmedSentence);
        }
      }
    }

    const keywords = Array.from(keywordsSet).slice(0, 5);

    return new Response(JSON.stringify({ users, keywords }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10' // Slight caching
      }
    });
  } catch (e: any) {
    console.error("Search suggestions API error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
