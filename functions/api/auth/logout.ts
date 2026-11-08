// functions/api/auth/logout.ts
export const onRequestGet = async () => {
  const headers = new Headers();
  headers.set('Location', '/');
  headers.append('Set-Cookie', 'gv_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');
  headers.append('Set-Cookie', 'gv_user=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure');

  return new Response(null, {
    status: 302,
    headers
  });
};
