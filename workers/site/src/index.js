// Serves the static site and forwards the review-comments API to the comments Worker.
// Only /api/* reaches this code (see run_worker_first); everything else is served
// straight from the asset store.
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/comments' || url.pathname.startsWith('/api/comments/')) {
      if (!env.COMMENTS?.fetch) return json(503, { error: 'comments_unavailable' });
      try {
        const res = await env.COMMENTS.fetch(request);
        const out = new Response(res.body, res);
        out.headers.set('Cache-Control', 'no-store');
        return out;
      } catch (err) {
        console.error('comments proxy failed', err);
        return json(503, { error: 'comments_unavailable' });
      }
    }
    if (url.pathname.startsWith('/api/')) return json(404, { error: 'not_found' });
    return env.ASSETS.fetch(request);
  },
};
