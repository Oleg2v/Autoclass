// Pages Function: same-origin proxy for the review comments API.
// /api/comments/* on the site is forwarded unchanged (method, path, query, headers
// incl. X-Review-Key, body) to the "autoclass-comments" Worker through the
// COMMENTS service binding declared in /wrangler.toml.

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

// Same cap as the Worker (LIMITS.body in workers/comments/src/validate.js).
const MAX_BODY = 16 * 1024;

const reply = (status, error, message) =>
  new Response(JSON.stringify({ error, message }), { status, headers: JSON_HEADERS });
const unavailable = (message) => reply(503, 'comments_unavailable', message);

export async function onRequest({ request, env }) {
  if (!env.COMMENTS || typeof env.COMMENTS.fetch !== 'function') {
    return unavailable('COMMENTS service binding is not configured');
  }

  const method = request.method.toUpperCase();
  // Cheap refusals before any body is touched: the Worker checks the key itself, but a
  // request without one (or with an oversized body) is not worth an upload.
  if (method !== 'OPTIONS' && !request.headers.get('X-Review-Key')) {
    return reply(401, 'unauthorized', 'missing or wrong X-Review-Key');
  }
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) {
    return reply(413, 'too_large', 'request body too large');
  }

  const url = new URL(request.url);
  // Host is irrelevant for a service binding; keep path + query intact.
  const target = new URL(url.pathname + url.search, 'https://autoclass-comments.internal');

  const headers = new Headers(request.headers);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('CF-Connecting-IP', ip);
  headers.delete('Cookie'); // the API never needs site cookies

  const init = { method, headers, redirect: 'manual' };
  // Streamed, not buffered: the Worker reads at most MAX_BODY bytes of it.
  if (method !== 'GET' && method !== 'HEAD' && request.body) {
    init.body = request.body;
    init.duplex = 'half'; // required by the fetch spec for stream bodies
  }

  try {
    const res = await env.COMMENTS.fetch(new Request(target, init));
    // The Worker always answers JSON (or CSV); anything else is the platform
    // reporting that the service itself is unreachable.
    const type = res.headers.get('Content-Type') || '';
    if (res.status >= 500 && !/json|csv/i.test(type)) {
      console.error('comments service error', res.status, (await res.text()).slice(0, 200));
      return unavailable('comments service did not answer');
    }
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (err) {
    console.error('comments proxy failed', err);
    return unavailable('comments service did not answer');
  }
}
