// Input validation for the comments API. Pure functions, no I/O.
// Every check throws HttpError(400) with a machine-readable `field`.

export const LIMITS = Object.freeze({
  selector: 500,
  snippet: 120,
  author: 60,
  text: 2000,
  page: 100,
  body: 16 * 1024, // bytes of JSON per request
});

export class HttpError extends Error {
  constructor(status, error, message, extra = {}) {
    super(message || error);
    this.status = status;
    this.body = { error, message: message || error, ...extra };
  }
}

const bad = (field, message) => new HttpError(400, 'invalid', message, { field });

// Control characters except \t and \n (\r is normalised away first).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Bidi embeddings / overrides / isolates (LRE RLE PDF LRO RLO, LRI RLI FSI PDI). An
// unbalanced one in a one-line field (author, snippet) garbles the text around it.
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;

// Characters that draw nothing: spaces, format characters (zero-width, bidi marks),
// default-ignorables (fillers, variation selectors) and the blank braille pattern.
const INVISIBLE = /[\s\p{Z}\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]/gu;
const isBlank = (s) => s.replace(INVISIBLE, '') === '';

function cleanText(value) {
  return String(value).replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();
}

export function parsePage(value) {
  if (value === undefined || value === null || value === '') return 'home';
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,99}$/.test(value)) {
    throw bad('page', 'page must be 1-100 chars of [A-Za-z0-9/_.-]');
  }
  return value;
}

export function parseAuthor(value, field = 'author') {
  if (typeof value !== 'string') throw bad(field, `${field} is required`);
  const author = cleanText(value).replace(BIDI, '').replace(/\s+/g, ' ').trim();
  if (isBlank(author)) throw bad(field, `${field} is required`);
  if (author.length > LIMITS.author) throw bad(field, `${field} is longer than ${LIMITS.author} characters`);
  return author;
}

export function parseText(value) {
  if (typeof value !== 'string') throw bad('text', 'text is required');
  const text = cleanText(value);
  if (isBlank(text)) throw bad('text', 'text must not be empty');
  if (text.length > LIMITS.text) throw bad('text', `text is longer than ${LIMITS.text} characters`);
  return text;
}

// clientId is an opaque random token the widget keeps in localStorage. It is the
// only "ownership" proof for deletes, so it is never returned by the API.
export function parseClientId(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad('clientId', 'clientId is required');
    return null;
  }
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
    throw bad('clientId', 'clientId must be 8-64 chars of [A-Za-z0-9_-]');
  }
  return value;
}

function finite(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(field, `${field} must be a number`);
  if (value < min || value > max) throw bad(field, `${field} must be between ${min} and ${max}`);
  return value;
}

// Percentages: tolerate float noise just outside 0..100, then clamp.
function pct(value, field) {
  const n = finite(value, field, -0.5, 100.5);
  return Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
}

export function parseAnchor(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw bad('anchor', 'anchor must be an object');

  if (typeof a.selector !== 'string') throw bad('anchor.selector', 'anchor.selector is required');
  // One line, no control characters (NUL, newlines) even though it is only ever used
  // as a querySelector argument and a CSV cell.
  const selector = cleanText(a.selector).replace(/\s+/g, ' ');
  if (isBlank(selector)) throw bad('anchor.selector', 'anchor.selector is required');
  if (selector.length > LIMITS.selector) throw bad('anchor.selector', `anchor.selector is longer than ${LIMITS.selector} characters`);

  if (a.dir !== 'rtl' && a.dir !== 'ltr') throw bad('anchor.dir', 'anchor.dir must be "rtl" or "ltr"');

  let snippet = '';
  if (a.snippet !== undefined && a.snippet !== null) {
    if (typeof a.snippet !== 'string') throw bad('anchor.snippet', 'anchor.snippet must be a string');
    snippet = cleanText(a.snippet).replace(BIDI, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.snippet);
  }

  return {
    selector,
    xPct: pct(a.xPct, 'anchor.xPct'),
    yPct: pct(a.yPct, 'anchor.yPct'),
    dir: a.dir,
    docXPct: pct(a.docXPct, 'anchor.docXPct'),
    docY: Math.round(finite(a.docY, 'anchor.docY', 0, 1_000_000)),
    vw: Math.round(finite(a.vw, 'anchor.vw', 1, 20_000)),
    vh: Math.round(finite(a.vh, 'anchor.vh', 1, 20_000)),
    snippet,
  };
}

export function parseCreate(body) {
  return {
    page: parsePage(body.page),
    anchor: parseAnchor(body.anchor),
    author: parseAuthor(body.author),
    text: parseText(body.text),
    clientId: parseClientId(body.clientId),
  };
}

export function parseReply(body) {
  return {
    author: parseAuthor(body.author),
    text: parseText(body.text),
    clientId: parseClientId(body.clientId),
  };
}

export function parseResolve(body) {
  if (typeof body.resolved !== 'boolean') throw bad('resolved', 'resolved must be a boolean');
  return { resolved: body.resolved, author: parseAuthor(body.author) };
}

export function parseId(value, field = 'id') {
  if (typeof value !== 'string' || !/^[a-z0-9]{6,32}$/.test(value)) {
    throw new HttpError(404, 'not_found', `unknown ${field}`);
  }
  return value;
}

// Rate-limit bucket for a client address (CF-Connecting-IP). IPv4 addresses count one
// by one; IPv6 addresses by their /64 prefix, since a single subscriber usually gets a
// whole /64 and could otherwise rotate through it.
export function rateKey(ip) {
  const s = String(ip || '').trim().toLowerCase().replace(/%.*$/, '');
  if (!s) return 'unknown';
  if (!s.includes(':')) return s.slice(0, 64);
  const mapped = /^(?:::|(?:0{1,4}:){5})ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (mapped) return mapped[1]; // IPv4-mapped IPv6 counts as the IPv4 address
  const halves = s.split('::');
  if (halves.length > 2) return s.slice(0, 64);
  const groups = (part) => (part ? part.split(':') : []).flatMap((g) => (g.includes('.') ? ['0', '0'] : [g]));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return s.slice(0, 64);
  const all = [...head, ...Array(fill).fill('0'), ...tail];
  if (all.length !== 8 || !all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return s.slice(0, 64);
  return `${all.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}
