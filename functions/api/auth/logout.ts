// functions/api/auth/logout.ts
export const onRequestGet = async () => {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `gv_user=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
      }
    });
};
