/**
 * Account tokens are verified without a database call (isAdmin() is synchronous). On staff routes this
 * middleware also re-checks the account against the database, so a deactivated account, a changed
 * password or a changed role is signed out on its very next request. Static pages never run it.
 */
import { defineMiddleware } from 'astro:middleware';
import { masterAdmin } from '@/lib/attendance/server';
import { USER_COOKIE, getAccountStore, viewer } from '@/lib/accounts/server';

const STAFF = /^\/(admin|api\/admin)(\/|$)/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered || !STAFF.test(ctx.url.pathname) || !ctx.cookies.get(USER_COOKIE)) return next();
  const claims = viewer(ctx.cookies);
  const store = getAccountStore();
  let current = Boolean(claims);
  try {
    if (claims && store) current = await store.isCurrent(claims);
  } catch (error) {
    console.error('[accounts] could not re-check the account', error); // keep the signed token on a database hiccup
  }
  if (current || masterAdmin(ctx.cookies)) return next();
  // revoked: clear the cookie and stop this request (the cookie was already read for it)
  const clear = `${USER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (ctx.url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Your session has ended. Sign in again.' }), { status: 401, headers: { 'content-type': 'application/json', 'set-cookie': clear } });
  }
  return new Response(null, { status: 303, headers: { location: `/login?next=${encodeURIComponent(ctx.url.pathname)}&ended=1`, 'set-cookie': clear } });
});
