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
  const author = cleanText(value).replace(/\s+/g, ' ');
  if (!author) throw bad(field, `${field} is required`);
  if (author.length > LIMITS.author) throw bad(field, `${field} is longer than ${LIMITS.author} characters`);
  return author;
}

export function parseText(value) {
  if (typeof value !== 'string') throw bad('text', 'text is required');
  const text = cleanText(value);
  if (!text) throw bad('text', 'text must not be empty');
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

  if (typeof a.selector !== 'string' || !a.selector.trim()) throw bad('anchor.selector', 'anchor.selector is required');
  const selector = a.selector.trim();
  if (selector.length > LIMITS.selector) throw bad('anchor.selector', `anchor.selector is longer than ${LIMITS.selector} characters`);

  if (a.dir !== 'rtl' && a.dir !== 'ltr') throw bad('anchor.dir', 'anchor.dir must be "rtl" or "ltr"');

  let snippet = '';
  if (a.snippet !== undefined && a.snippet !== null) {
    if (typeof a.snippet !== 'string') throw bad('anchor.snippet', 'anchor.snippet must be a string');
    snippet = cleanText(a.snippet).replace(/\s+/g, ' ').slice(0, LIMITS.snippet);
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
