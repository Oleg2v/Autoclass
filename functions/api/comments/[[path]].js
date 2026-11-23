// Pages Function: same-origin proxy for the review comments API.
// /api/comments/* on the site is forwarded unchanged (method, path, query, headers
// incl. X-Review-Key, body) to the "autoclass-comments" Worker through the
// COMMENTS service binding declared in /wrangler.toml.

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const unavailable = (message) =>
  new Response(JSON.stringify({ error: 'comments_unavailable', message }), { status: 503, headers: JSON_HEADERS });

export async function onRequest({ request, env }) {
  if (!env.COMMENTS || typeof env.COMMENTS.fetch !== 'function') {
    return unavailable('COMMENTS service binding is not configured');
  }

  const url = new URL(request.url);
  // Host is irrelevant for a service binding; keep path + query intact.
  const target = new URL(url.pathname + url.search, 'https://autoclass-comments.internal');

  const headers = new Headers(request.headers);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('CF-Connecting-IP', ip);
  headers.delete('Cookie'); // the API never needs site cookies

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();

  try {
    const res = await env.COMMENTS.fetch(new Request(target, init));
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (err) {
    console.error('comments proxy failed', err);
    return unavailable('comments service did not answer');
  }
}
