// functions/api/auth/login.ts
export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } = env;
  
  const urlObj = new URL(request.url);
  const source = urlObj.searchParams.get('source');
  const state = source === 'app' ? 'app' : '';

  // プレースホルダーのままであれば、設定方法を教えるHTMLを返す
  if (DISCORD_CLIENT_ID === "YOUR_CLIENT_ID") {
    return new Response(`
      <div style="font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 600px; margin: 0 auto; background: #2c2f33; color: white; border-radius: 12px; margin-top: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: #7289da;">🚧 Discord連携の準備が必要です</h2>
        <p>Discordでログインするには、<strong>Client ID</strong> の設定が必要です。</p>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;"><a href="https://discord.com/developers/applications" target="_blank" style="color: #00b0f4; font-weight: bold;">Discord Developer Portal</a> を開き、新しい Application を作成します。</li>
          <li style="margin-bottom: 10px;"><strong>OAuth2</strong> セクション of <strong>Redirects</strong> に <code>${DISCORD_REDIRECT_URI}</code> を追加して保存します。</li>
          <li style="margin-bottom: 10px;"><strong>Client ID</strong> と <strong>Client Secret</strong> をコピーします。</li>
          <li style="margin-bottom: 10px;">プロジェクト内の <code>wrangler.toml</code> を開き、<code>YOUR_CLIENT_ID</code> などの部分を書き換えてください。</li>
        </ol>
        <p style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; font-size: 0.9rem;">
          設定が終わったら、このページを閉じて、もう一度「Discordでログイン」ボタンを押してください。
        </p>
        <button onclick="window.close()" style="background: #7289da; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">閉じる</button>
      </div>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    state: state,
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  
  return Response.redirect(url);
};
