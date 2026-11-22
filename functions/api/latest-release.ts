// functions/api/latest-release.ts
// Edge-cached proxy fallback for checking GitHub Releases (resilient against client-side rate limits or network blocks).

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/PizzaRoleplayOfficial/pizza-citzen-portal/releases?per_page=5';
const CACHE_KEY_URL = 'https://pizza-citzen-portal.pages.dev/__cache/latest-release';

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

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PizzaPortal-Updater/2.9',
    };
    if (env?.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    const upstream = await fetch(GITHUB_RELEASES_URL, { headers });
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch releases', status: upstream.status }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const bodyText = await upstream.text();
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
      JSON.stringify({ error: 'Failed to fetch releases', message: err?.message || 'Unknown error' }),
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
