// CommentsRoom: SQLite-backed Durable Object that owns every review thread.
// One instance (named "autoclass") holds all pages, so exports are a single query
// and the per-page sequential `num` is allocated without races (a DO is
// single-threaded and synchronous SQL calls run atomically).
//
// The Worker in index.js validates input and calls these methods over RPC.
// Methods return plain objects: { status, ...payload } or { status, error }.

import { DurableObject } from 'cloudflare:workers';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_WRITES = 30; // per client (IPv4 address or IPv6 /64, see rateKey)
const RATE_MAX_TOTAL = 200; // across all clients, so notifications cannot be flooded

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS threads (
     id          TEXT PRIMARY KEY,
     num         INTEGER NOT NULL,
     page        TEXT NOT NULL,
     anchor      TEXT NOT NULL,
     author      TEXT NOT NULL,
     text        TEXT NOT NULL,
     client_id   TEXT,
     created     INTEGER NOT NULL,
     resolved    INTEGER NOT NULL DEFAULT 0,
     resolved_by TEXT,
     resolved_at INTEGER
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS threads_page_num ON threads(page, num)`,
  `CREATE TABLE IF NOT EXISTS replies (
     id         TEXT PRIMARY KEY,
     thread_id  TEXT NOT NULL,
     author     TEXT NOT NULL,
     text       TEXT NOT NULL,
     client_id  TEXT,
     created    INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS replies_thread ON replies(thread_id, created)`,
  // Last number handed out per page, so numbers are never reused after a delete.
  `CREATE TABLE IF NOT EXISTS counters (
     page     TEXT PRIMARY KEY,
     last_num INTEGER NOT NULL
   )`,
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
function newId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(11));
  let id = prefix;
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

function toReply(row, clientId) {
  return {
    id: row.id,
    author: row.author,
    text: row.text,
    created: iso(row.created),
    mine: Boolean(clientId && row.client_id === clientId),
  };
}

function toThread(row, replies, clientId) {
  return {
    id: row.id,
    num: row.num,
    page: row.page,
    anchor: JSON.parse(row.anchor),
    author: row.author,
    text: row.text,
    created: iso(row.created),
    resolved: Boolean(row.resolved),
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: iso(row.resolved_at),
    replies: replies.map((r) => toReply(r, clientId)),
    mine: Boolean(clientId && row.client_id === clientId),
  };
}

export class CommentsRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.hits = new Map(); // client key -> timestamps of recent writes (in memory is enough for 30/min)
    this.allHits = []; // timestamps of recent writes from everyone
    for (const stmt of SCHEMA) this.sql.exec(stmt);
  }

  // ---- helpers ---------------------------------------------------------------

  #limited(ip) {
    const now = Date.now();
    const key = ip || 'unknown';
    const tooMany = (oldest, max) => ({
      status: 429,
      error: 'rate_limited',
      message: `max ${max} writes per minute`,
      retryAfter: Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000)),
    });
    const recent = (this.hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_WRITES) {
      this.hits.set(key, recent);
      return tooMany(recent[0], RATE_MAX_WRITES);
    }
    while (this.allHits.length && now - this.allHits[0] >= RATE_WINDOW_MS) this.allHits.shift();
    if (this.allHits.length >= RATE_MAX_TOTAL) return tooMany(this.allHits[0], RATE_MAX_TOTAL);
    recent.push(now);
    this.allHits.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 2000) {
      for (const [k, list] of this.hits) if (!list.length || now - list[list.length - 1] >= RATE_WINDOW_MS) this.hits.delete(k);
    }
    return null;
  }

  #row(id) {
    return this.sql.exec('SELECT * FROM threads WHERE id = ?', id).toArray()[0] || null;
  }

  #replies(threadId) {
    return this.sql.exec('SELECT * FROM replies WHERE thread_id = ? ORDER BY created, rowid', threadId).toArray();
  }

  #thread(id, clientId) {
    const row = this.#row(id);
    return row ? toThread(row, this.#replies(id), clientId) : null;
  }

  #assemble(rows, replyRows, clientId) {
    const byThread = new Map();
    for (const r of replyRows) {
      if (!byThread.has(r.thread_id)) byThread.set(r.thread_id, []);
      byThread.get(r.thread_id).push(r);
    }
    return rows.map((row) => toThread(row, byThread.get(row.id) || [], clientId));
  }

  // ---- reads -----------------------------------------------------------------

  list(page, clientId) {
    const rows = this.sql.exec('SELECT * FROM threads WHERE page = ? ORDER BY created, num', page).toArray();
    const replies = this.sql
      .exec(
        `SELECT r.* FROM replies r JOIN threads t ON t.id = r.thread_id
         WHERE t.page = ? ORDER BY r.created, r.rowid`,
        page,
      )
      .toArray();
    return { status: 200, threads: this.#assemble(rows, replies, clientId) };
  }

  get(id, clientId) {
    const thread = this.#thread(id, clientId);
    return thread ? { status: 200, thread } : { status: 404, error: 'not_found', message: 'thread not found' };
  }

  exportAll() {
    const rows = this.sql.exec('SELECT * FROM threads ORDER BY page, num').toArray();
    const replies = this.sql.exec('SELECT * FROM replies ORDER BY created, rowid').toArray();
    const threads = this.#assemble(rows, replies, null).map(({ mine, replies: rs, ...t }) => ({
      ...t,
      replies: rs.map(({ mine: _m, ...r }) => r),
    }));
    return { status: 200, threads };
  }

  // ---- writes ----------------------------------------------------------------

  create(input, meta = {}) {
    const limited = this.#limited(meta.ip);
    if (limited) return limited;
    const now = Date.now();
    const id = newId('t');
    this.ctx.storage.transactionSync(() => {
      const cur = this.sql.exec('SELECT last_num FROM counters WHERE page = ?', input.page).toArray()[0];
      const fromThreads = this.sql.exec('SELECT COALESCE(MAX(num), 0) AS n FROM threads WHERE page = ?', input.page).one().n;
      const num = Math.max(cur ? cur.last_num : 0, fromThreads) + 1;
      this.sql.exec(
        `INSERT INTO counters (page, last_num) VALUES (?, ?)
         ON CONFLICT(page) DO UPDATE SET last_num = excluded.last_num`,
        input.page,
        num,
      );
      this.sql.exec(
        `INSERT INTO threads (id, num, page, anchor, author, text, client_id, created, resolved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        id,
        num,
        input.page,
        JSON.stringify(input.anchor),
        input.author,
        input.text,
        input.clientId,
        now,
      );
    });
    return { status: 201, thread: this.#thread(id, input.clientId) };
  }

  reply(threadId, input, meta = {}) {
    const limited = this.#limited(meta.ip);
    if (limited) return limited;
    if (!this.#row(threadId)) return { status: 404, error: 'not_found', message: 'thread not found' };
    const id = newId('r');
    this.sql.exec(
      'INSERT INTO replies (id, thread_id, author, text, client_id, created) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      threadId,
      input.author,
      input.text,
      input.clientId,
      Date.now(),
    );
    const row = this.sql.exec('SELECT * FROM replies WHERE id = ?', id).one();
    return { status: 201, reply: toReply(row, input.clientId), thread: this.#thread(threadId, input.clientId) };
  }

  resolve(threadId, input, meta = {}) {
    const limited = this.#limited(meta.ip);
    if (limited) return limited;
    if (!this.#row(threadId)) return { status: 404, error: 'not_found', message: 'thread not found' };
    if (input.resolved) {
      this.sql.exec(
        'UPDATE threads SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?',
        input.author,
        Date.now(),
        threadId,
      );
    } else {
      this.sql.exec('UPDATE threads SET resolved = 0, resolved_by = NULL, resolved_at = NULL WHERE id = ?', threadId);
    }
    return { status: 200, thread: this.#thread(threadId, meta.clientId) };
  }

  // Own thread, and only while nobody has replied to it.
  deleteThread(threadId, clientId, meta = {}) {
    const limited = this.#limited(meta.ip);
    if (limited) return limited;
    const row = this.#row(threadId);
    if (!row) return { status: 404, error: 'not_found', message: 'thread not found' };
    if (!clientId || row.client_id !== clientId) {
      return { status: 403, error: 'forbidden', message: 'only the author can delete this comment' };
    }
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM replies WHERE thread_id = ?', threadId).one().n;
    if (n > 0) return { status: 409, error: 'has_replies', message: 'comments with replies cannot be deleted' };
    this.sql.exec('DELETE FROM threads WHERE id = ?', threadId);
    return { status: 200, ok: true, id: threadId };
  }

  // Own reply, and only while nobody has replied after it (it is the last message).
  deleteReply(threadId, replyId, clientId, meta = {}) {
    const limited = this.#limited(meta.ip);
    if (limited) return limited;
    const row = this.sql.exec('SELECT rowid AS rid, * FROM replies WHERE id = ? AND thread_id = ?', replyId, threadId).toArray()[0];
    if (!row) return { status: 404, error: 'not_found', message: 'reply not found' };
    if (!clientId || row.client_id !== clientId) {
      return { status: 403, error: 'forbidden', message: 'only the author can delete this reply' };
    }
    const later = this.sql
      .exec(
        `SELECT COUNT(*) AS n FROM replies
         WHERE thread_id = ? AND id != ? AND (created > ? OR (created = ? AND rowid > ?))`,
        threadId,
        replyId,
        row.created,
        row.created,
        row.rid,
      )
      .one().n;
    if (later > 0) return { status: 409, error: 'has_replies', message: 'replies followed by other replies cannot be deleted' };
    this.sql.exec('DELETE FROM replies WHERE id = ?', replyId);
    return { status: 200, ok: true, id: replyId };
  }
}
