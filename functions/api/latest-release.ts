// functions/api/latest-release.ts
// Edge-cached release endpoint with rate-limit-free github.com web fallback.

const REPO_OWNER = 'PizzaRoleplayOfficial';
const REPO_NAME = 'pizza-citzen-portal';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=5`;
const GITHUB_LATEST_WEB = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const CACHE_KEY_URL = 'https://pizza-citzen-portal.pages.dev/__cache/latest-release-v2';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

async function fetchFromGitHubWeb(): Promise<string> {
  const latestRes = await fetch(GITHUB_LATEST_WEB, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PizzaPortal-Updater/2.9',
    },
    redirect: 'follow',
  });

  if (!latestRes.ok) {
    throw new Error(`GitHub web latest returned status ${latestRes.status}`);
  }

  let tagName = '';
  const contentType = latestRes.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const latestJson = (await latestRes.json()) as { tag_name?: string };
      if (latestJson?.tag_name) {
        tagName = latestJson.tag_name;
      }
    } catch {
      // Fall back to resolved redirect URL below
    }
  }

  if (!tagName) {
    const urlMatch = latestRes.url.match(/\/releases\/tag\/([^/?#]+)/);
    if (urlMatch?.[1]) {
      tagName = decodeURIComponent(urlMatch[1]);
    }
  }

  if (!tagName) {
    throw new Error('Could not resolve latest release tag_name from GitHub web');
  }

  const assetsMap = new Map<string, ReleaseAsset>();
  try {
    const expandedUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/expanded_assets/${encodeURIComponent(tagName)}`;
    const assetsRes = await fetch(expandedUrl, {
      headers: {
        'User-Agent': 'PizzaPortal-Updater/2.9',
      },
    });
    if (assetsRes.ok) {
      const html = await assetsRes.text();
      const linkRegex = new RegExp(
        `href="(/${REPO_OWNER}/${REPO_NAME}/releases/download/[^"']+)"`,
        'g'
      );
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        const relPath = match[1];
        const rawFile = relPath.split('/').pop() || '';
        const name = decodeURIComponent(rawFile.split('?')[0]);
        if (name && !assetsMap.has(name)) {
          assetsMap.set(name, {
            name,
            browser_download_url: `https://github.com${relPath}`,
          });
        }
      }
    }
  } catch {
    // Synthesize defaults below if expanded_assets fails
  }

  if (assetsMap.size === 0) {
    const cleanVer = tagName.replace(/^v/, '');
    assetsMap.set('pizza-portal.apk', {
      name: 'pizza-portal.apk',
      browser_download_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${encodeURIComponent(tagName)}/pizza-portal.apk`,
    });
    const exeName = `PizzaPortal-Setup-${cleanVer}.exe`;
    assetsMap.set(exeName, {
      name: exeName,
      browser_download_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${encodeURIComponent(tagName)}/${exeName}`,
    });
  }

  return JSON.stringify([
    {
      tag_name: tagName,
      name: `ぴっざぁ市民総合ポータル ${tagName}`,
      body: `最新バージョン ${tagName} が公開されました。`,
      assets: Array.from(assetsMap.values()),
    },
  ]);
}

export const onRequestGet = async ({ env }: { env?: Record<string, any> }) => {
  try {
    const cache = (caches as any)?.default;
    const cacheReq = new Request(CACHE_KEY_URL, { method: 'GET' });

    if (cache) {
      const cached = await cache.match(cacheReq);
      if (cached) {
        return new Response(cached.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }
    }

    let bodyText: string | null = null;

    try {
      const apiHeaders: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'PizzaPortal-Updater/2.9',
      };
      if (env?.GITHUB_TOKEN) {
        apiHeaders.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
      }

      const upstream = await fetch(GITHUB_RELEASES_API, { headers: apiHeaders });
      if (upstream.ok) {
        const text = await upstream.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          bodyText = text;
        }
      }
    } catch {
      // Proceed to GitHub web fallback
    }

    if (!bodyText) {
      bodyText = await fetchFromGitHubWeb();
    }

    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    };

    if (cache) {
      try {
        await cache.put(cacheReq, new Response(bodyText, { status: 200, headers: responseHeaders }));
      } catch {
        // Ignore cache write errors in local/preview runtimes
      }
    }

    return new Response(bodyText, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch releases',
        message: err?.message || 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
};
