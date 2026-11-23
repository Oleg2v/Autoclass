// autoclass-comments: review comment API for the Auto Class site.
//
//   GET    /api/comments?page=home[&clientId=]       -> { threads }
//   POST   /api/comments                             -> thread   (201)
//   GET    /api/comments/export?format=json|csv      -> all threads
//   GET    /api/comments/:id                         -> thread
//   PATCH  /api/comments/:id                         -> thread   { resolved, author }
//   DELETE /api/comments/:id?clientId=               -> { ok }   own + no replies
//   POST   /api/comments/:id/replies                 -> reply    (201)
//   DELETE /api/comments/:id/replies/:rid?clientId=  -> { ok }   own + last message
//
// Every request except OPTIONS needs `X-Review-Key: <REVIEW_KEY>`.
// Storage: one SQLite-backed Durable Object (CommentsRoom), see room.js.

import { CommentsRoom } from './room.js';
import { notify } from './notify.js';
import {
  HttpError,
  LIMITS,
  parseClientId,
  parseCreate,
  parseId,
  parsePage,
  parseReply,
  parseResolve,
  rateKey,
} from './validate.js';

export { CommentsRoom };

const PREFIX = '/api/comments';
const ROOM_NAME = 'autoclass-review-2026';
const ALLOW = 'GET, POST, PATCH, DELETE, OPTIONS';

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extra },
  });
}

// Turn a DO result ({ status, error?, ... }) into a Response.
function fromRoom(result, pick) {
  if (result.error) {
    const { status, ...body } = result;
    const extra = result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {};
    return json(body, status, extra);
  }
  return json(pick(result), result.status);
}

async function keyMatches(given, expected) {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// Reads at most LIMITS.body bytes, also when the body is chunked (no Content-Length).
async function readJson(request) {
  const tooLarge = () => new HttpError(413, 'too_large', 'request body too large');
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > LIMITS.body) throw tooLarge();
  let raw = '';
  if (request.body) {
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.body) {
        reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      buf.set(c, at);
      at += c.byteLength;
    }
    raw = new TextDecoder().decode(buf);
  }
  let body;
  try {
    body = JSON.parse(raw || 'null');
  } catch {
    throw new HttpError(400, 'invalid_json', 'body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_json', 'body must be a JSON object');
  return body;
}

const publicThread = (t) => {
  if (!t) return t;
  const { mine, replies, ...rest } = t;
  return { ...rest, replies: (replies || []).map(({ mine: _m, ...r }) => r) };
};
const publicReply = (r) => {
  if (!r) return r;
  const { mine, ...rest } = r;
  return rest;
};

// ---- CSV export ----------------------------------------------------------------

function csvCell(value) {
  let s = value == null ? '' : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(threads) {
  const header = [
    'page', 'num', 'thread_id', 'kind', 'message_id', 'author', 'created', 'text',
    'status', 'resolved_by', 'resolved_at', 'selector', 'snippet',
  ];
  const lines = [header.join(',')];
  for (const t of threads) {
    const status = t.resolved ? 'resolved' : 'open';
    const common = [t.resolvedBy, t.resolvedAt, t.anchor && t.anchor.selector, t.anchor && t.anchor.snippet];
    lines.push([t.page, t.num, t.id, 'comment', t.id, t.author, t.created, t.text, status, ...common].map(csvCell).join(','));
    for (const r of t.replies) {
      lines.push([t.page, t.num, t.id, 'reply', r.id, r.author, r.created, r.text, status, ...common].map(csvCell).join(','));
    }
  }
  // BOM so Excel opens Hebrew / Russian text as UTF-8.
  return `﻿${lines.join('\r\n')}\r\n`;
}

// ---- router --------------------------------------------------------------------

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) {
    return json({ error: 'not_found', message: 'not found' }, 404);
  }
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    // Same-origin API: no CORS grants, just advertise what exists.
    return new Response(null, { status: 204, headers: { Allow: ALLOW, ...BASE_HEADERS } });
  }

  if (!env.REVIEW_KEY) return json({ error: 'not_configured', message: 'REVIEW_KEY is not set' }, 503);
  if (!(await keyMatches(request.headers.get('X-Review-Key'), env.REVIEW_KEY))) {
    return json({ error: 'unauthorized', message: 'missing or wrong X-Review-Key' }, 401);
  }

  // Decoded only after auth; a malformed escape (%E0, %ZZ) is an unknown path, not a 500.
  const parts = path
    .slice(PREFIX.length)
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        throw new HttpError(404, 'not_found', 'not found');
      }
    });

  const room = env.ROOMS.get(env.ROOMS.idFromName(ROOM_NAME));
  const meta = { ip: rateKey(request.headers.get('CF-Connecting-IP')) };
  const notAllowed = (allow) => json({ error: 'method_not_allowed', message: `use ${allow}` }, 405, { Allow: allow });

  // /api/comments
  if (parts.length === 0) {
    if (method === 'GET') {
      const page = parsePage(url.searchParams.get('page'));
      const clientId = parseClientId(url.searchParams.get('clientId'));
      return fromRoom(await room.list(page, clientId), (r) => ({ threads: r.threads }));
    }
    if (method === 'POST') {
      const input = parseCreate(await readJson(request));
      const result = await room.create(input, meta);
      if (!result.error) ctx.waitUntil(notify(env, 'thread.created', publicThread(result.thread)));
      return fromRoom(result, (r) => r.thread);
    }
    return notAllowed('GET, POST, OPTIONS');
  }

  // /api/comments/export
  if (parts.length === 1 && parts[0] === 'export') {
    if (method !== 'GET') return notAllowed('GET');
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') throw new HttpError(400, 'invalid', 'format must be json or csv', { field: 'format' });
    const { threads } = await room.exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    const disposition = `attachment; filename="autoclass-comments-${stamp}.${format}"`;
    if (format === 'csv') {
      return new Response(toCsv(threads), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': disposition, ...BASE_HEADERS },
      });
    }
    return json({ exported: new Date().toISOString(), count: threads.length, threads }, 200, { 'Content-Disposition': disposition });
  }

  const id = parseId(parts[0]);

  // /api/comments/:id
  if (parts.length === 1) {
    if (method === 'GET') {
      return fromRoom(await room.get(id, parseClientId(url.searchParams.get('clientId'))), (r) => r.thread);
    }
    if (method === 'PATCH') {
      const body = await readJson(request);
      const input = parseResolve(body);
      const clientId = parseClientId(body.clientId);
      return fromRoom(await room.resolve(id, input, { ...meta, clientId }), (r) => r.thread);
    }
    if (method === 'DELETE') {
      const clientId = parseClientId(url.searchParams.get('clientId'), { required: true });
      return fromRoom(await room.deleteThread(id, clientId, meta), (r) => ({ ok: true, id: r.id }));
    }
    return notAllowed('GET, PATCH, DELETE, OPTIONS');
  }

  // /api/comments/:id/replies
  if (parts[1] === 'replies' && parts.length === 2) {
    if (method !== 'POST') return notAllowed('POST, OPTIONS');
    const input = parseReply(await readJson(request));
    const result = await room.reply(id, input, meta);
    if (!result.error) ctx.waitUntil(notify(env, 'reply.created', publicThread(result.thread), publicReply(result.reply)));
    return fromRoom(result, (r) => r.reply);
  }

  // /api/comments/:id/replies/:rid
  if (parts[1] === 'replies' && parts.length === 3) {
    const rid = parseId(parts[2], 'reply id');
    if (method !== 'DELETE') return notAllowed('DELETE, OPTIONS');
    const clientId = parseClientId(url.searchParams.get('clientId'), { required: true });
    return fromRoom(await room.deleteReply(id, rid, clientId, meta), (r) => ({ ok: true, id: r.id }));
  }

  return json({ error: 'not_found', message: 'not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json(err.body, err.status);
      console.error('comments API error', err && err.stack ? err.stack : err);
      return json({ error: 'internal', message: 'internal error' }, 500);
    }
  },
};
