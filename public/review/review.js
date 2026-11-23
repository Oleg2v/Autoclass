/*
 * Auto Class review layer: Figma-style comments pinned to page elements.
 *
 * Vanilla ES module, zero dependencies, no build step. The page loads it only when
 * the URL has ?review=<key> or a key is stored in localStorage('acr-key'); see
 * docs/COMMENTS.md. User data is only ever rendered with textContent; innerHTML is
 * used solely for the static SVG icons defined below.
 */

const API = '/api/comments';
const POLL_MS = 20000;
const MAX_TEXT = 2000;
const MAX_NAME = 60;
// The key travels in an HTTP header: printable ASCII only, or fetch() throws before sending.
const KEY_RE = /^[\x21-\x7e]{1,200}$/;
const UNSENT_MS = 4000; // a second "leave" within this time discards / closes anyway
const LS = {
  key: 'acr-key',
  name: 'acr-name',
  lang: 'acr-lang',
  client: 'acr-client',
  resolved: 'acr-show-resolved',
  filter: 'acr-filter',
};

// ─────────────────────────────── i18n ───────────────────────────────

const he = {
  toolbar: 'סרגל סקירה',
  comments: 'הערות',
  modeOn: 'יציאה ממצב הערות',
  modeOff: 'מצב הערות: לחצו על אלמנט כדי להעיר',
  openCount: (n) => (n === 1 ? 'הערה פתוחה אחת' : `${n} הערות פתוחות`),
  list: 'רשימת הערות',
  langShort: 'RU',
  langSwitch: 'Переключить на русский',
  exit: 'יציאה ממצב סקירה',
  hintPointer: 'לחצו על אלמנט כדי להשאיר הערה · Esc ליציאה',
  hintTouch: 'הקישו על אלמנט כדי להשאיר הערה',
  newComment: 'הערה חדשה',
  placeholder: 'מה כדאי לשנות כאן?',
  post: 'פרסום',
  cancel: 'ביטול',
  replyPh: 'תגובה…',
  reply: 'שליחה',
  resolve: 'סימון כנפתרה',
  reopen: 'פתיחה מחדש',
  resolvedBy: (n, t) => `נפתרה ע״י ${n} · ${t}`,
  del: 'מחיקה',
  delConfirm: 'למחוק?',
  close: 'סגירה',
  thread: (n) => `הערה #${n}`,
  pinLabel: (n, a, r) => `הערה #${n} מאת ${a}${r ? ' (נפתרה)' : ''}`,
  detached: 'האלמנט אינו מוצג בגודל המסך הזה, המיקום משוער',
  element: 'אלמנט',
  nameTitle: 'איך לקרוא לך?',
  nameHint: 'השם יופיע ליד ההערות שלך. בלי הרשמה.',
  namePh: 'השם שלך',
  save: 'שמירה',
  yourName: 'השם שלך:',
  changeName: 'שינוי שם',
  filterLabel: 'סינון',
  filterOpen: 'פתוחות',
  filterAll: 'הכל',
  showResolved: 'הצגת סיכות שנפתרו',
  statusOpen: 'פתוחה',
  statusResolved: 'נפתרה',
  empty: 'אין עדיין הערות. הפעילו את מצב ההערות ולחצו על אלמנט בדף.',
  emptyOpen: 'אין הערות פתוחות.',
  exportJson: 'ייצוא JSON',
  exportCsv: 'ייצוא CSV',
  replies: (n) => (n === 1 ? 'תגובה אחת' : n === 2 ? 'שתי תגובות' : `${n} תגובות`),
  sending: 'שולח…',
  justNow: 'עכשיו',
  posted: 'ההערה נשמרה',
  errAuth: 'מפתח הסקירה שגוי. בקשו קישור חדש.',
  errNet: 'אין חיבור לשרת. נסו שוב.',
  errRate: 'יותר מדי פעולות. המתינו דקה.',
  errInvalid: 'ההודעה ריקה או ארוכה מדי.',
  errForbidden: 'אי אפשר למחוק: יש תגובות או שזו לא ההודעה שלך.',
  errGone: 'ההערה כבר לא קיימת.',
  errServer: 'שגיאת שרת. נסו שוב.',
  shortcut: 'Ctrl+Enter לשליחה',
  unsentDraft: 'ההערה עוד לא נשלחה. כדי לבטל אותה, לחצו שוב.',
  unsentReply: 'התגובה עוד לא נשלחה. לחצו שוב כדי לסגור, הטקסט יישמר.',
  replyDraft: 'יש כאן תגובה שלא נשלחה',
};

const ru = {
  toolbar: 'Панель ревью',
  comments: 'Комментарии',
  modeOn: 'Выключить режим комментариев',
  modeOff: 'Режим комментариев: кликните по элементу',
  openCount: (n) => `Открытых комментариев: ${n}`,
  list: 'Список комментариев',
  langShort: 'עב',
  langSwitch: 'החלפה לעברית',
  exit: 'Выйти из режима ревью',
  hintPointer: 'Кликните по элементу, чтобы оставить комментарий · Esc — выход',
  hintTouch: 'Нажмите на элемент, чтобы оставить комментарий',
  newComment: 'Новый комментарий',
  placeholder: 'Что здесь поправить?',
  post: 'Отправить',
  cancel: 'Отмена',
  replyPh: 'Ответить…',
  reply: 'Ответить',
  resolve: 'Решено',
  reopen: 'Открыть снова',
  resolvedBy: (n, t) => `Решено: ${n} · ${t}`,
  del: 'Удалить',
  delConfirm: 'Точно?',
  close: 'Закрыть',
  thread: (n) => `Комментарий #${n}`,
  pinLabel: (n, a, r) => `Комментарий #${n}, автор ${a}${r ? ' (решён)' : ''}`,
  detached: 'Элемент не виден на этом размере экрана, позиция примерная',
  element: 'Элемент',
  nameTitle: 'Как вас зовут?',
  nameHint: 'Имя будет видно рядом с вашими комментариями. Без регистрации.',
  namePh: 'Ваше имя',
  save: 'Сохранить',
  yourName: 'Ваше имя:',
  changeName: 'Сменить имя',
  filterLabel: 'Фильтр',
  filterOpen: 'Открытые',
  filterAll: 'Все',
  showResolved: 'Показывать решённые метки',
  statusOpen: 'Открыт',
  statusResolved: 'Решён',
  empty: 'Комментариев пока нет. Включите режим комментариев и кликните по элементу страницы.',
  emptyOpen: 'Открытых комментариев нет.',
  exportJson: 'Экспорт JSON',
  exportCsv: 'Экспорт CSV',
  replies: (n) => {
    const f = new Intl.PluralRules('ru').select(n);
    return `${n} ${f === 'one' ? 'ответ' : f === 'few' ? 'ответа' : 'ответов'}`;
  },
  sending: 'Отправка…',
  justNow: 'только что',
  posted: 'Комментарий сохранён',
  errAuth: 'Неверный ключ ревью. Попросите новую ссылку.',
  errNet: 'Нет связи с сервером. Попробуйте ещё раз.',
  errRate: 'Слишком много действий. Подождите минуту.',
  errInvalid: 'Сообщение пустое или слишком длинное.',
  errForbidden: 'Нельзя удалить: есть ответы или это не ваш комментарий.',
  errGone: 'Комментарий уже удалён.',
  errServer: 'Ошибка сервера. Попробуйте ещё раз.',
  shortcut: 'Ctrl+Enter — отправить',
  unsentDraft: 'Комментарий ещё не отправлен. Нажмите ещё раз, чтобы отменить его.',
  unsentReply: 'Ответ ещё не отправлен. Нажмите ещё раз, чтобы закрыть: текст сохранится.',
  replyDraft: 'Здесь есть неотправленный ответ',
};

const I18N = { he, ru };

// Static icons (never user data).
const ICONS = {
  comment: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0.5A2.5 2.5 0 0 1 5 12.5z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  exit: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 8l-4 4 4 4M6 12h10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  undo: '<path d="M9 7L5 11l4 4M5 11h9.5a4.5 4.5 0 0 1 0 9H12"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
};

// ─────────────────────────────── utils ───────────────────────────────

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* private mode */
    }
  },
};

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

function icon(name) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="acr-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
  return t.content.firstChild;
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const round2 = (v) => Math.round(v * 100) / 100;
const randId = (n) => {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join('');
};
const isEditable = (el) =>
  !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''));

// ─────────────────────────────── state ───────────────────────────────

const HTML = document.documentElement;
const PAGE_DIR = getComputedStyle(HTML).direction === 'rtl' ? 'rtl' : 'ltr';
// Page id, same rule as the API's parsePage: [A-Za-z0-9] first, then [A-Za-z0-9/_.-].
// Percent-encoded (Hebrew) slugs become e.g. "D7-A9-D7-9C"; stable, if not pretty.
function pageId(raw) {
  const id = String(raw || '')
    .replace(/\/index\.html?$/, '/')
    .replace(/\.html?$/, '')
    .replace(/[^A-Za-z0-9/_.-]/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 100)
    .replace(/\/+$/, '');
  return id || 'home';
}
const PAGE = pageId(HTML.dataset.acrPage || location.pathname);
const MQ_SHEET = matchMedia('(max-width: 640px)');
const MQ_FINE = matchMedia('(hover: hover) and (pointer: fine)');
const MQ_REDUCE = matchMedia('(prefers-reduced-motion: reduce)');

const S = {
  key: null,
  lang: store.get(LS.lang) === 'ru' ? 'ru' : 'he',
  name: store.get(LS.name) || '',
  client: null,
  threads: [],
  loaded: false,
  mode: false,
  active: null, // { type: 'draft', anchor } | { type: 'thread', id }
  drawer: false,
  modal: null,
  filter: store.get(LS.filter) === 'all' ? 'all' : 'open',
  showResolved: store.get(LS.resolved) === '1',
  pendingResolve: new Map(),
  replyDrafts: new Map(), // thread id -> unsent reply text (survives closing the popover)
  returnFocus: null,
  netErr: false,
  authErr: false,
};
const T = () => I18N[S.lang];

let root, layer, bar, modeBtn, modeLabel, countEl, listBtn, langBtn, exitBtn;
let hint, hover, pop, drawer, toastEl, cssLink, draftPin;
let drawerRefs = {};
let popRefs = null;
const pins = new Map(); // thread id -> <button>
const elCache = new Map(); // selector -> Element
let rafId = 0;
let tickId = 0;
let pollId = 0;
let toastId = 0;
let hintId = 0;
let ro = null;
let pointer = null;
let inflight = null;
let spacer = null; // temporary room below the document for a bottom-sheet pin
let sheetTopSeen = 0;
let unsentAt = 0;

const byId = (id) => S.threads.find((t) => t.id === id) || null;
const isWidget = (el) => !!(el && el.nodeType === 1 && el.closest('.acr-root, .acr-layer'));
const isSheet = () => MQ_SHEET.matches;

// ─────────────────────────────── API ───────────────────────────────

function badKeyError() {
  const err = new Error('invalid review key');
  err.status = 401; // reported like a wrong key, which it is
  return err;
}

async function api(method, path = '', body, query) {
  if (!KEY_RE.test(S.key || '')) throw badKeyError();
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const headers = { 'X-Review-Key': S.key, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path + qs, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    const err = new Error('network');
    err.status = 0;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function errMsg(e) {
  const t = T();
  const s = e && e.status;
  if (s === 401) return t.errAuth;
  if (s === 429) return t.errRate;
  if (s === 400 || s === 413) return t.errInvalid;
  if (s === 403 || s === 409) return t.errForbidden;
  if (s === 404) return t.errGone;
  if (!s) return t.errNet;
  return t.errServer;
}

function toast(msg, kind = 'err') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `acr-toast acr-on acr-${kind}`;
  clearTimeout(toastId);
  toastId = setTimeout(() => toastEl.classList.remove('acr-on'), kind === 'ok' ? 2200 : kind === 'info' ? 4000 : 5000);
}

// ─────────────────────────────── time ───────────────────────────────

function relTime(iso) {
  const ms = Date.parse(iso);
  if (!ms) return '';
  const s = Math.round((ms - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 45) return T().justNow;
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  let unit = 'minute';
  let div = 60;
  for (const [u, sec] of units) if (a >= sec) [unit, div] = [u, sec];
  // ICU's Hebrew repeats the count ("לפני דקה (1)", "לפני שעתיים (2)") and says "the week
  // that passed" for -1 week; past times read better from a small table.
  if (S.lang === 'he' && s < 0) return heAgo(Math.max(1, Math.round(a / div)), unit);
  try {
    return new Intl.RelativeTimeFormat(S.lang, { numeric: 'auto' }).format(Math.round(s / div), unit);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

const HE_AGO = {
  minute: ['לפני דקה', 'לפני 2 דקות', 'דקות'],
  hour: ['לפני שעה', 'לפני שעתיים', 'שעות'],
  day: ['אתמול', 'שלשום', 'ימים'],
  week: ['לפני שבוע', 'לפני שבועיים', 'שבועות'],
  month: ['לפני חודש', 'לפני חודשיים', 'חודשים'],
  year: ['לפני שנה', 'לפני שנתיים', 'שנים'],
};
function heAgo(n, unit) {
  const [one, two, many] = HE_AGO[unit];
  return n === 1 ? one : n === 2 ? two : `לפני ${n} ${many}`;
}

function absTime(iso) {
  const ms = Date.parse(iso);
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString(S.lang === 'he' ? 'he-IL' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(ms).toLocaleString();
  }
}

// ─────────────────────────────── anchoring ───────────────────────────────

function nthOfType(el) {
  let n = 1;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === el.localName) n++;
  return n;
}

// Closest ancestor (or self) with [data-cid] or a unique id is the stable base; then
// a short :nth-of-type path (max depth 4) leads down towards the clicked element.
function anchorTargetFor(target) {
  if (!target || target.nodeType !== 1 || isWidget(target)) return null;
  const chain = [];
  let base = null;
  let baseSel = 'body';
  for (let cur = target; cur && cur.nodeType === 1; cur = cur.parentElement) {
    if (cur === document.body || cur === HTML) break;
    const cid = cur.getAttribute('data-cid');
    if (cid) {
      base = cur;
      baseSel = `[data-cid="${CSS.escape(cid)}"]`;
      break;
    }
    if (cur.id && !/^acr-/.test(cur.id)) {
      const sel = `#${CSS.escape(cur.id)}`;
      let unique = false;
      try {
        unique = document.querySelectorAll(sel).length === 1;
      } catch {
        unique = false;
      }
      if (unique) {
        base = cur;
        baseSel = sel;
        break;
      }
    }
    chain.push(cur);
  }
  if (!base) base = document.body;
  const steps = chain.reverse().slice(0, 4); // top-down from the base
  let selector = baseSel;
  for (const node of steps) selector += ` > ${CSS.escape(node.localName)}:nth-of-type(${nthOfType(node)})`;
  return { el: steps.length ? steps[steps.length - 1] : base, selector, baseSel };
}

function snippetOf(el, fallbackEl) {
  const pick = (e) =>
    e
      ? (e.innerText || e.textContent || '').trim() ||
        e.getAttribute('aria-label') ||
        e.getAttribute('alt') ||
        e.getAttribute('title') ||
        ''
      : '';
  let s = pick(el) || pick(fallbackEl) || `<${el.localName}>`;
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

function captureAnchor(ev) {
  const a = anchorTargetFor(ev.target);
  if (!a) return null;
  let el = null;
  let selector = a.selector;
  try {
    el = document.querySelector(selector);
  } catch {
    el = null;
  }
  if (!el || isWidget(el)) {
    selector = a.baseSel;
    el = document.querySelector(selector) || document.body;
  }
  let x = ev.clientX;
  let y = ev.clientY;
  if (!ev.detail && !x && !y) {
    // keyboard-activated click: use the target's centre
    const r = ev.target.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const r = el.getBoundingClientRect();
  const hr = HTML.getBoundingClientRect();
  const fromStart = (rect) => (PAGE_DIR === 'rtl' ? rect.right - x : x - rect.left);
  return {
    selector,
    xPct: round2(clamp(r.width ? (fromStart(r) / r.width) * 100 : 50, 0, 100)),
    yPct: round2(clamp(r.height ? ((y - r.top) / r.height) * 100 : 50, 0, 100)),
    dir: PAGE_DIR,
    docXPct: round2(clamp(hr.width ? (fromStart(hr) / hr.width) * 100 : 50, 0, 100)),
    docY: Math.max(0, Math.round(y - hr.top)),
    vw: innerWidth,
    vh: innerHeight,
    snippet: snippetOf(el, ev.target),
  };
}

function findEl(selector) {
  const hit = elCache.get(selector);
  if (hit && hit.isConnected) return hit;
  let el = null;
  try {
    el = document.querySelector(selector);
  } catch {
    el = null;
  }
  if (el && isWidget(el)) el = null;
  if (el) elCache.set(selector, el);
  else elCache.delete(selector);
  return el;
}

function shownRect(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (typeof el.checkVisibility === 'function') {
    if (!el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true, checkVisibilityProperty: true })) return null;
  } else {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  }
  return r;
}

// Viewport point for an anchor. Percentages are read in the direction the anchor was
// recorded in (the PAGE direction), never the widget's UI language.
function resolvePoint(anchor) {
  const rtl = anchor.dir === 'rtl';
  const el = findEl(anchor.selector);
  const r = el && shownRect(el);
  if (r) {
    return {
      x: rtl ? r.right - (anchor.xPct / 100) * r.width : r.left + (anchor.xPct / 100) * r.width,
      y: r.top + (anchor.yPct / 100) * r.height,
      detached: false,
    };
  }
  const hr = HTML.getBoundingClientRect();
  return {
    x: rtl ? hr.right - (anchor.docXPct / 100) * hr.width : hr.left + (anchor.docXPct / 100) * hr.width,
    y: hr.top + anchor.docY,
    detached: true,
  };
}

// ─────────────────────────────── pins + layout ───────────────────────────────

function visibleThreads() {
  const activeId = S.active && S.active.type === 'thread' ? S.active.id : null;
  return S.threads.filter((t) => !t.resolved || S.showResolved || t.id === activeId);
}

function renderPins() {
  if (!layer) return;
  const want = S.mode ? visibleThreads() : [];
  const seen = new Set();
  let created = false;
  const t = T();
  for (const th of want) {
    let b = pins.get(th.id);
    if (!b) {
      const id = th.id;
      b = h('button', {
        type: 'button',
        class: 'acr-pin',
        'data-acr-id': id,
        style: PIN_PARKED, // until layout() has placed it
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (S.active && S.active.type === 'draft' && popRefs && popRefs.ta.value.trim()) {
            pulseDraft();
            return;
          }
          if (S.active && S.active.type === 'thread' && S.active.id === id) closePopover();
          else openThread(id, b);
        },
      });
      pins.set(id, b);
      layer.append(b);
      created = true;
    }
    b.textContent = th.pending ? '…' : String(th.num);
    b.classList.toggle('acr-resolved', !!th.resolved);
    b.classList.toggle('acr-pending', !!th.pending);
    b.classList.toggle('acr-active', !!(S.active && S.active.type === 'thread' && S.active.id === th.id));
    const drafted = S.replyDrafts.has(th.id);
    b.classList.toggle('acr-has-draft', drafted);
    b.setAttribute('aria-label', t.pinLabel(th.pending ? '…' : th.num, th.author, th.resolved) + (drafted ? ` · ${t.replyDraft}` : ''));
    b._title = null; // refreshed by layout()
    seen.add(th.id);
  }
  for (const [id, b] of pins) {
    if (!seen.has(id)) {
      b.remove();
      pins.delete(id);
    }
  }
  const drafting = S.mode && S.active && S.active.type === 'draft';
  if (drafting && !draftPin.isConnected) {
    layer.append(draftPin);
    created = true;
  }
  if (!drafting && draftPin.isConnected) {
    draftPin.remove();
    draftPin.setAttribute('style', PIN_PARKED);
  }
  if (created && S.mode) {
    // place new pins now rather than next frame, so they never show up late
    if (rafId) cancelAnimationFrame(rafId);
    layout();
  } else schedule();
}

// Hidden, and parked inside the document (incl. the 6px hit-area pseudo-element)
// until layout() places it.
const PIN_PARKED = 'visibility:hidden;transform:translate(16px,48px)';

function schedule() {
  if (!rafId && S.mode) rafId = requestAnimationFrame(layout);
}

function layout() {
  rafId = 0;
  if (!S.mode || !layer) return;
  const lr = layer.getBoundingClientRect();
  const hr = HTML.getBoundingClientRect();
  const docH = Math.max(hr.height, HTML.scrollHeight);
  // The pin box sits on the inline-start side of its tip (left of it on an RTL page).
  // Offsets live in the transform, never in margins, and the clamp keeps the whole
  // 44px hit area inside the document: a box poking past the edge, even for one
  // frame, makes mobile Chrome widen the layout viewport.
  const PIN = 32;
  const EDGE = 8;
  const rtl = PAGE_DIR === 'rtl';
  const minX = hr.left + EDGE + (rtl ? PIN : 0);
  const maxX = hr.right - EDGE - (rtl ? 0 : PIN);
  const minY = hr.top + PIN + EDGE;
  const maxY = hr.top + docH - EDGE;
  const ox = rtl ? -PIN : 0;
  const t = T();

  const place = (el, anchor) => {
    const p = resolvePoint(anchor);
    const x = clamp(p.x, minX, maxX);
    const y = clamp(p.y, minY, maxY);
    el.style.transform = `translate(${Math.round(x - lr.left + ox)}px, ${Math.round(y - lr.top - PIN)}px)`;
    if (el.style.visibility) el.style.visibility = '';
    if (el._detached !== p.detached) {
      el._detached = p.detached;
      el.classList.toggle('acr-detached', p.detached);
    }
    return p;
  };

  for (const [id, b] of pins) {
    const th = byId(id);
    if (!th) continue;
    const p = place(b, th.anchor);
    const title = p.detached ? t.detached : `#${th.pending ? '…' : th.num} · ${th.author}`;
    if (b._title !== title) {
      b._title = title;
      b.title = title;
    }
  }
  if (draftPin.isConnected && S.active && S.active.type === 'draft') place(draftPin, S.active.anchor);
  placePopover();
  updateHover();
}

function activePinEl() {
  if (!S.active) return null;
  if (S.active.type === 'draft') return draftPin.isConnected ? draftPin : null;
  return pins.get(S.active.id) || null;
}

function placePopover() {
  if (!S.active || pop.hidden) return;
  if (isSheet()) {
    pop.classList.add('acr-sheet');
    pop.style.left = '';
    pop.style.top = '';
    return;
  }
  pop.classList.remove('acr-sheet');
  const pin = activePinEl();
  if (!pin) return;
  const pr = pin.getBoundingClientRect();
  const vw = HTML.clientWidth || innerWidth;
  const vh = innerHeight;
  const w = pop.offsetWidth;
  const hgt = pop.offsetHeight;
  const m = 12;
  // Open towards the side of the page the pin's body points to, flip if no room.
  const after = PAGE_DIR === 'rtl' ? pr.left - 10 - w : pr.right + 10;
  const before = PAGE_DIR === 'rtl' ? pr.right + 10 : pr.left - 10 - w;
  let left = after;
  if (left < m || left + w > vw - m) left = before;
  left = clamp(left, m, Math.max(m, vw - w - m));
  const top = clamp(pr.top - 6, m, Math.max(m, vh - hgt - m));
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function updateHover() {
  const off = () => hover.classList.remove('acr-on');
  // While a popover is open a page click only closes it, so no anchor preview then.
  if (!S.mode || !MQ_FINE.matches || !pointer || S.modal || S.active || S.drawer) return off();
  const el = document.elementFromPoint(pointer.x, pointer.y);
  if (!el || isWidget(el) || el === HTML || el === document.body) return off();
  const a = anchorTargetFor(el);
  if (!a) return off();
  const r = a.el.getBoundingClientRect();
  hover.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
  hover.style.width = `${Math.round(r.width)}px`;
  hover.style.height = `${Math.round(r.height)}px`;
  hover.classList.add('acr-on');
}

// ─────────────────────────────── scrolling ───────────────────────────────

function scrollToY(y) {
  const top = Math.max(0, Math.round(y));
  const lenis = window.__lenis;
  if (lenis && typeof lenis.scrollTo === 'function') lenis.scrollTo(top);
  else window.scrollTo({ top, behavior: MQ_REDUCE.matches ? 'auto' : 'smooth' });
}

// On phones the sheet covers the lower part of the screen: scroll so the pin sits in
// the free area above it. A pin near the end of the document cannot be scrolled that
// high, so a temporary spacer in the pin layer adds the room (removed on close).
function revealAboveSheet(anchor) {
  if (!isSheet() || !anchor || pop.hidden) return;
  const sheetTop = pop.getBoundingClientRect().top;
  sheetTopSeen = sheetTop;
  const p = resolvePoint(anchor);
  const minY = 32 + 24; // the pin box rises 32px above its tip
  const maxY = sheetTop - 16;
  if (p.y >= minY && p.y <= maxY) return;
  const want = Math.max(minY, Math.round(sheetTop * 0.5));
  const target = Math.max(0, Math.round(scrollY + p.y - want));
  const se = document.scrollingElement || HTML;
  const short = target - (se.scrollHeight - innerHeight);
  if (short > 0) growSpacer(short + 8);
  scrollToY(target);
}

// The sheet grows with replies and the "resolved by" note: keep the pin above it.
function followSheet(anchor) {
  if (!isSheet() || pop.hidden) return;
  const top = pop.getBoundingClientRect().top;
  const grew = top < sheetTopSeen - 2;
  sheetTopSeen = top;
  if (grew) revealAboveSheet(anchor);
}

function growSpacer(px) {
  if (!spacer) {
    const se = document.scrollingElement || HTML;
    const layerTop = layer.getBoundingClientRect().top + scrollY;
    spacer = h('div', { class: 'acr-spacer', 'aria-hidden': 'true' });
    spacer._h = 0;
    spacer.style.top = `${Math.round(se.scrollHeight - layerTop)}px`;
    layer.append(spacer);
  }
  spacer._h += Math.ceil(px);
  spacer.style.height = `${spacer._h}px`;
  lenisResize();
}

function dropSpacer() {
  if (!spacer) return;
  spacer.remove();
  spacer = null;
  lenisResize();
}

function lenisResize() {
  const lenis = window.__lenis;
  if (lenis && typeof lenis.resize === 'function') lenis.resize();
}

// ─────────────────────────────── comment mode ───────────────────────────────

const GUARDED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'submit'];
const TOUCH = ['touchstart', 'touchend'];

function guard(e) {
  if (isWidget(e.target)) return;
  e.stopPropagation();
  if (e.type === 'mousedown' || e.type === 'submit' || e.type === 'auxclick' || e.type === 'dblclick') {
    if (e.cancelable) e.preventDefault();
  }
}

function onPageClick(e) {
  if (isWidget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (e.button) return;
  if (S.modal) return;
  if (S.drawer) {
    closeDrawer(false);
    return;
  }
  if (S.active) {
    // A typed new comment is never thrown away by a stray click: flash it instead.
    if (S.active.type === 'draft' && hasUnsent()) {
      pulseDraft();
      return;
    }
    if (S.active.type === 'thread' && keepUnsent()) return;
    const wasThread = S.active.type === 'thread';
    closePopover(false);
    if (wasThread) return;
  }
  const anchor = captureAnchor(e);
  if (anchor) openDraft(anchor);
}

function pulseDraft(focus = true) {
  pop.classList.remove('acr-pulse');
  void pop.offsetWidth;
  pop.classList.add('acr-pulse');
  if (focus && popRefs && popRefs.ta) popRefs.ta.focus({ preventScroll: true });
}

const hasUnsent = () => !!(S.active && popRefs && popRefs.ta && popRefs.ta.value.trim());

// Leaving a popover that holds typed text: the first attempt flashes it and says what a
// second attempt (within UNSENT_MS) will do. Returns true when the caller must stop.
// A new comment is discarded by the second attempt; a reply stays in S.replyDrafts.
function keepUnsent() {
  if (!hasUnsent()) return false;
  const now = Date.now();
  if (now - unsentAt < UNSENT_MS) return false;
  unsentAt = now;
  const draft = S.active.type === 'draft';
  pulseDraft(draft || !isSheet()); // no keyboard pop-up on phones for a reply
  toast(draft ? T().unsentDraft : T().unsentReply, 'info');
  return true;
}
const keepDraft = () => !!(S.active && S.active.type === 'draft' && keepUnsent());

function onPointerMove(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  pointer = { x: e.clientX, y: e.clientY };
  schedule();
}

function onPointerLeave() {
  pointer = null;
  schedule();
}

function setMode(on) {
  on = !!on;
  if (S.mode === on) return;
  if (!on && keepDraft()) return;
  S.mode = on;
  HTML.classList.toggle('acr-commenting', on);
  layer.classList.toggle('acr-off', !on);
  modeBtn.setAttribute('aria-pressed', String(on));
  modeBtn.title = `${on ? T().modeOn : T().modeOff} (C)`;
  hint.classList.toggle('acr-on', on);
  clearTimeout(hintId);
  if (on) hintId = setTimeout(() => hint.classList.remove('acr-on'), 6000);
  if (on) {
    addEventListener('click', onPageClick, true);
    for (const type of GUARDED) addEventListener(type, guard, true);
    for (const type of TOUCH) addEventListener(type, guard, { capture: true, passive: true });
    addEventListener('scroll', schedule, { capture: true, passive: true });
    addEventListener('resize', schedule, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    HTML.addEventListener('pointerleave', onPointerLeave);
    if (!ro && 'ResizeObserver' in window) ro = new ResizeObserver(schedule);
    if (ro) ro.observe(document.body);
    tickId = setInterval(schedule, 1000); // catches animations that move elements without scrolling
  } else {
    removeEventListener('click', onPageClick, true);
    for (const type of GUARDED) removeEventListener(type, guard, true);
    for (const type of TOUCH) removeEventListener(type, guard, { capture: true });
    removeEventListener('scroll', schedule, { capture: true });
    removeEventListener('resize', schedule);
    document.removeEventListener('pointermove', onPointerMove);
    HTML.removeEventListener('pointerleave', onPointerLeave);
    if (ro) ro.disconnect();
    clearInterval(tickId);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    pointer = null;
    hover.classList.remove('acr-on');
    closePopover(false);
  }
  renderPins();
}

// ─────────────────────────────── popover ───────────────────────────────

function showPop() {
  pop.hidden = false;
  if (isSheet()) pop.classList.add('acr-sheet');
  layout();
}

function closePopover(restore = true) {
  if (!S.active) return;
  S.active = null;
  pop.hidden = true;
  pop.replaceChildren();
  pop.className = 'acr-pop';
  popRefs = null;
  renderPins();
  // openThread / openDraft close the old popover first and reopen synchronously; the
  // spacer only goes once nothing is open any more.
  queueMicrotask(() => {
    if (!S.active) dropSpacer();
  });
  const f = S.returnFocus;
  S.returnFocus = null;
  if (restore) {
    const target = f && f.isConnected && typeof f.focus === 'function' ? f : modeBtn;
    target.focus({ preventScroll: true });
  }
}

function iconButton(name, label, onclick, cls = 'acr-btn acr-btn-ico') {
  return h('button', { type: 'button', class: cls, 'aria-label': label, title: label, onclick }, icon(name));
}

function submitOnCtrlEnter(ta, form) {
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
}

function openDraft(anchor, text = '') {
  closePopover(false);
  unsentAt = 0;
  S.active = { type: 'draft', anchor };
  S.returnFocus = modeBtn;
  const t = T();
  const ta = h('textarea', {
    class: 'acr-ta',
    rows: '3',
    maxlength: String(MAX_TEXT),
    dir: 'auto',
    placeholder: t.placeholder,
    'aria-label': t.placeholder,
  });
  ta.value = text;
  const send = h('button', { type: 'submit', class: 'acr-btn acr-btn-primary' }, t.post);
  const form = h(
    'form',
    {
      class: 'acr-form',
      onsubmit: (e) => {
        e.preventDefault();
        submitDraft(ta);
      },
    },
    ta,
    h(
      'div',
      { class: 'acr-form-row' },
      h('span', { class: 'acr-kbd acr-grow' }, MQ_FINE.matches ? t.shortcut : ''),
      h('button', { type: 'button', class: 'acr-btn acr-btn-ghost', onclick: () => closePopover() }, t.cancel),
      send,
    ),
  );
  submitOnCtrlEnter(ta, form);
  pop.className = 'acr-pop acr-pop-draft';
  pop.setAttribute('aria-labelledby', 'acr-pop-title');
  pop.replaceChildren(
    h(
      'div',
      { class: 'acr-pop-head' },
      h('h2', { class: 'acr-pop-title acr-grow', id: 'acr-pop-title' }, t.newComment),
      iconButton('close', t.close, () => closePopover()),
    ),
    anchor.snippet ? h('p', { class: 'acr-snip', dir: 'auto', title: anchor.snippet }, `${t.element}: ${anchor.snippet}`) : null,
    form,
  );
  popRefs = { ta, form };
  renderPins();
  showPop();
  revealAboveSheet(anchor);
  ta.focus({ preventScroll: true });
}

function openThread(id, from) {
  const th = byId(id);
  if (!th) return;
  if (!S.mode) setMode(true);
  closePopover(false);
  unsentAt = 0;
  S.active = { type: 'thread', id };
  S.returnFocus = from || (document.activeElement !== document.body ? document.activeElement : modeBtn);
  buildThreadPopover(th);
  renderPins();
  showPop();
  if (isSheet()) {
    revealAboveSheet(th.anchor);
    pop.focus({ preventScroll: true });
  } else popRefs.ta.focus({ preventScroll: true });
}

function buildThreadPopover(th) {
  const t = T();
  const title = h('h2', { class: 'acr-pop-title', id: 'acr-pop-title' });
  const chip = h('span', { class: 'acr-chip' });
  const resolveBtn = h('button', {
    type: 'button',
    class: 'acr-btn acr-btn-sm acr-btn-ghost acr-resolve',
    onclick: () => S.active && toggleResolve(S.active.id),
  });
  const body = h('div', { class: 'acr-pop-body' });
  const ta = h('textarea', {
    class: 'acr-ta',
    rows: '2',
    maxlength: String(MAX_TEXT),
    dir: 'auto',
    placeholder: t.replyPh,
    'aria-label': t.replyPh,
  });
  const tid = th.id;
  ta.value = S.replyDrafts.get(tid) || '';
  ta.addEventListener('input', () => {
    if (ta.value.trim()) S.replyDrafts.set(tid, ta.value);
    else S.replyDrafts.delete(tid);
  });
  const send = h('button', { type: 'submit', class: 'acr-btn acr-btn-primary' }, t.reply);
  const form = h(
    'form',
    {
      class: 'acr-form',
      onsubmit: (e) => {
        e.preventDefault();
        submitReply(ta);
      },
    },
    ta,
    h('div', { class: 'acr-form-row' }, h('span', { class: 'acr-kbd acr-grow' }, MQ_FINE.matches ? t.shortcut : ''), send),
  );
  submitOnCtrlEnter(ta, form);
  pop.className = 'acr-pop acr-pop-thread';
  pop.setAttribute('aria-labelledby', 'acr-pop-title');
  pop.replaceChildren(
    h('div', { class: 'acr-pop-head' }, title, chip, h('span', { class: 'acr-grow' }), resolveBtn, iconButton('close', t.close, () => closePopover())),
    body,
    form,
  );
  popRefs = { title, chip, resolveBtn, body, ta, send, form };
  fillThread(th);
}

function deleteButton(onConfirm) {
  const t = T();
  const b = h('button', { type: 'button', class: 'acr-link acr-danger' }, t.del);
  let armed = 0;
  b.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      onConfirm();
      return;
    }
    b.textContent = t.delConfirm;
    b.classList.add('acr-confirm');
    armed = setTimeout(() => {
      armed = 0;
      b.textContent = t.del;
      b.classList.remove('acr-confirm');
    }, 3500);
  });
  return b;
}

function message(m, canDelete, onDelete) {
  const t = T();
  return h(
    'div',
    { class: `acr-msg${m.pending ? ' acr-pending' : ''}` },
    h(
      'div',
      { class: 'acr-msg-meta' },
      h('bdi', { class: 'acr-author' }, m.author),
      h('time', { class: 'acr-time', datetime: m.created, title: absTime(m.created) }, m.pending ? t.sending : relTime(m.created)),
      canDelete ? deleteButton(onDelete) : null,
    ),
    h('p', { class: 'acr-text', dir: 'auto' }, m.text),
  );
}

function fillThread(th) {
  if (!popRefs || !popRefs.body) return;
  const t = T();
  const { title, chip, resolveBtn, body, ta, send } = popRefs;
  title.textContent = th.pending ? '#…' : `#${th.num}`;
  title.setAttribute('aria-label', t.thread(th.pending ? '…' : th.num));
  chip.textContent = th.resolved ? t.statusResolved : t.statusOpen;
  chip.className = `acr-chip${th.resolved ? ' acr-is-resolved' : ''}`;
  resolveBtn.replaceChildren(icon(th.resolved ? 'undo' : 'check'), h('span', null, th.resolved ? t.reopen : t.resolve));
  resolveBtn.setAttribute('aria-pressed', String(!!th.resolved));
  resolveBtn.disabled = !!th.pending;
  ta.disabled = !!th.pending;
  send.disabled = !!th.pending;

  const scroll = body.scrollTop;
  const nodes = [];
  const pin = pins.get(th.id);
  if (pin && pin._detached) nodes.push(h('p', { class: 'acr-note acr-warn' }, t.detached));
  if (th.anchor && th.anchor.snippet) nodes.push(h('p', { class: 'acr-snip', dir: 'auto', title: th.anchor.snippet }, `${t.element}: ${th.anchor.snippet}`));
  const msgs = h('div', { class: 'acr-msgs' });
  msgs.append(message(th, th.mine && !th.pending && th.replies.length === 0, () => deleteThread(th.id)));
  th.replies.forEach((r, i) => {
    const last = i === th.replies.length - 1;
    msgs.append(message(r, r.mine && !r.pending && last, () => deleteReply(th.id, r.id)));
  });
  nodes.push(msgs);
  if (th.resolved && th.resolvedBy) nodes.push(h('p', { class: 'acr-note' }, t.resolvedBy(th.resolvedBy, relTime(th.resolvedAt))));
  body.replaceChildren(...nodes);
  body.scrollTop = scroll;
  if (S.active && S.active.type === 'thread' && S.active.id === th.id) followSheet(th.anchor);
}

// ─────────────────────────────── actions ───────────────────────────────

function askName(force = false) {
  if (!force && S.name) return Promise.resolve(S.name);
  if (S.modal) return S.modal.promise;
  const t = T();
  let resolveFn;
  const promise = new Promise((r) => {
    resolveFn = r;
  });
  const prev = document.activeElement;
  const input = h('input', {
    class: 'acr-input',
    id: 'acr-name-input',
    type: 'text',
    maxlength: String(MAX_NAME),
    autocomplete: 'name',
    dir: 'auto',
    placeholder: t.namePh,
  });
  input.value = S.name || '';
  const cancel = h('button', { type: 'button', class: 'acr-btn acr-btn-ghost' }, t.cancel);
  const box = h(
    'form',
    {
      class: 'acr-modal-box',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'acr-name-title',
      'aria-describedby': 'acr-name-hint',
    },
    h('h2', { class: 'acr-h', id: 'acr-name-title' }, t.nameTitle),
    h('p', { class: 'acr-muted', id: 'acr-name-hint' }, t.nameHint),
    h('label', { class: 'acr-sr', for: 'acr-name-input' }, t.namePh),
    input,
    h('div', { class: 'acr-actions' }, cancel, h('button', { type: 'submit', class: 'acr-btn acr-btn-primary' }, t.save)),
  );
  const overlay = h('div', { class: 'acr-modal' }, box);
  const done = (value) => {
    overlay.remove();
    S.modal = null;
    if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
    resolveFn(value);
  };
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!v) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    S.name = v;
    store.set(LS.name, v);
    renderDrawerName();
    done(v);
  });
  cancel.addEventListener('click', () => done(null));
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      done(null);
    } else if (e.key === 'Tab') {
      const f = [...box.querySelectorAll('input, button')].filter((x) => !x.disabled);
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) e.preventDefault();
  });
  S.modal = { promise };
  root.append(overlay);
  hover.classList.remove('acr-on');
  input.focus();
  return promise;
}

function replaceThread(fresh) {
  const i = S.threads.findIndex((x) => x.id === fresh.id);
  if (i < 0) {
    S.threads.push(fresh);
    return;
  }
  const pend = S.threads[i].replies.filter((r) => r.pending);
  S.threads[i] = pend.length ? { ...fresh, replies: [...fresh.replies, ...pend] } : fresh;
}

async function submitDraft(ta) {
  const text = ta.value.trim();
  if (!text) {
    ta.focus();
    return;
  }
  const name = await askName();
  if (!name) {
    if (ta.isConnected) ta.focus();
    return;
  }
  if (!S.active || S.active.type !== 'draft') return;
  const anchor = S.active.anchor;
  const temp = {
    id: `tmp${randId(10)}`,
    num: 0,
    page: PAGE,
    anchor,
    author: name,
    text,
    created: new Date().toISOString(),
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    replies: [],
    mine: true,
    pending: true,
  };
  S.threads.push(temp);
  closePopover();
  renderAll();
  try {
    const th = await api('POST', '', { page: PAGE, anchor, author: name, text, clientId: S.client });
    const i = S.threads.findIndex((x) => x.id === temp.id);
    if (i >= 0) S.threads[i] = th;
    else replaceThread(th);
    if (S.active && S.active.type === 'thread' && S.active.id === temp.id) S.active.id = th.id;
    renderAll();
    toast(T().posted, 'ok');
  } catch (e) {
    S.threads = S.threads.filter((x) => x.id !== temp.id);
    renderAll();
    toast(errMsg(e));
    if (S.mode) openDraft(anchor, text);
  }
}

async function submitReply(ta) {
  if (!S.active || S.active.type !== 'thread') return;
  const th = byId(S.active.id);
  const text = ta.value.trim();
  if (!th || th.pending || !text) {
    ta.focus();
    return;
  }
  const name = await askName();
  if (!name) {
    if (ta.isConnected) ta.focus();
    return;
  }
  const temp = { id: `tmp${randId(10)}`, author: name, text, created: new Date().toISOString(), mine: true, pending: true };
  th.replies.push(temp);
  ta.value = '';
  S.replyDrafts.delete(th.id);
  renderAll();
  try {
    const reply = await api('POST', `/${encodeURIComponent(th.id)}/replies`, { author: name, text, clientId: S.client });
    const cur = byId(th.id);
    if (cur) {
      const i = cur.replies.findIndex((r) => r.id === temp.id);
      if (i >= 0) cur.replies[i] = reply;
      else if (!cur.replies.some((r) => r.id === reply.id)) cur.replies.push(reply);
    }
    renderAll();
  } catch (e) {
    const cur = byId(th.id);
    if (cur) cur.replies = cur.replies.filter((r) => r.id !== temp.id);
    renderAll();
    toast(errMsg(e));
    if (!S.replyDrafts.has(th.id)) S.replyDrafts.set(th.id, text);
    if (popRefs && popRefs.ta && S.active && S.active.id === th.id && !popRefs.ta.value) popRefs.ta.value = text;
    renderPins();
  }
}

async function toggleResolve(id) {
  const th = byId(id);
  if (!th || th.pending) return;
  const name = await askName();
  if (!name) return;
  const next = !th.resolved;
  const before = { resolved: th.resolved, resolvedBy: th.resolvedBy, resolvedAt: th.resolvedAt };
  Object.assign(th, { resolved: next, resolvedBy: next ? name : null, resolvedAt: next ? new Date().toISOString() : null });
  S.pendingResolve.set(id, next);
  renderAll();
  try {
    const fresh = await api('PATCH', `/${encodeURIComponent(id)}`, { resolved: next, author: name, clientId: S.client });
    replaceThread(fresh);
  } catch (e) {
    const cur = byId(id);
    if (cur) Object.assign(cur, before);
    toast(errMsg(e));
  } finally {
    S.pendingResolve.delete(id);
    renderAll();
  }
}

async function deleteThread(id) {
  try {
    await api('DELETE', `/${encodeURIComponent(id)}`, null, { clientId: S.client });
    S.threads = S.threads.filter((x) => x.id !== id);
    S.replyDrafts.delete(id);
    if (S.active && S.active.id === id) closePopover();
    renderAll();
  } catch (e) {
    toast(errMsg(e));
    refresh();
  }
}

async function deleteReply(threadId, replyId) {
  try {
    await api('DELETE', `/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`, null, { clientId: S.client });
    const th = byId(threadId);
    if (th) th.replies = th.replies.filter((r) => r.id !== replyId);
    renderAll();
  } catch (e) {
    toast(errMsg(e));
    refresh();
  }
}

async function doExport(format) {
  try {
    if (!KEY_RE.test(S.key || '')) throw badKeyError();
    const res = await fetch(`${API}/export?format=${format}`, {
      headers: { 'X-Review-Key': S.key },
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = new Error('export');
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `autoclass-comments-${new Date().toISOString().slice(0, 10)}.${format}` });
    root.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    toast(errMsg(e && e.status !== undefined ? e : { status: 0 }));
  }
}

// ─────────────────────────────── data ───────────────────────────────

function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await api('GET', '', null, { page: PAGE, clientId: S.client });
      const local = new Map(S.threads.map((t) => [t.id, t]));
      const merged = (data.threads || []).map((t) => {
        const mine = local.get(t.id);
        const pend = mine ? mine.replies.filter((r) => r.pending) : [];
        const out = pend.length ? { ...t, replies: [...t.replies, ...pend] } : t;
        if (S.pendingResolve.has(t.id)) out.resolved = S.pendingResolve.get(t.id);
        return out;
      });
      for (const t of S.threads) if (t.pending) merged.push(t);
      S.threads = merged;
      S.loaded = true;
      S.netErr = false;
      S.authErr = false;
      elCache.clear();
      renderAll();
      openFromHash();
    } catch (e) {
      if (e.status === 401) {
        if (!S.authErr) toast(T().errAuth);
        S.authErr = true;
      } else if (!S.netErr) {
        S.netErr = true;
        toast(errMsg(e));
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function updateCount() {
  const n = S.threads.filter((t) => !t.resolved).length;
  countEl.textContent = String(n);
  countEl.hidden = n === 0;
  // Explicit name: the visible label is hidden on very narrow screens.
  modeBtn.setAttribute('aria-label', `${T().comments}, ${T().openCount(n)}`);
}

function renderAll() {
  if (!root) return;
  updateCount();
  renderPins();
  if (S.drawer) renderList();
  if (S.active && S.active.type === 'thread') {
    const th = byId(S.active.id);
    if (th) fillThread(th);
    else closePopover();
  }
}

// ─────────────────────────────── drawer ───────────────────────────────

function firstLine(text) {
  const line = String(text).split('\n').find((l) => l.trim()) || '';
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
}

function goTo(id) {
  const th = byId(id);
  if (!th) return;
  closeDrawer(false);
  if (!S.mode) setMode(true);
  openThread(id, listBtn); // on phones this also lifts the pin above the sheet
  if (!isSheet()) scrollToY(scrollY + resolvePoint(th.anchor).y - innerHeight * 0.42);
}

function openFromHash() {
  const m = /^#acr-([a-z0-9]{6,32})$/i.exec(location.hash);
  if (!m || !S.loaded) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (byId(m[1])) goTo(m[1]);
  else toast(T().errGone);
}

function renderDrawerName() {
  if (drawerRefs.name) drawerRefs.name.textContent = S.name || '—';
}

function renderList() {
  const t = T();
  const all = S.threads.slice().sort((a, b) => (a.pending ? 1e9 : a.num) - (b.pending ? 1e9 : b.num));
  const items = S.filter === 'open' ? all.filter((x) => !x.resolved) : all;
  const open = all.filter((x) => !x.resolved).length;
  drawerRefs.title.textContent = `${t.comments} (${open}/${all.length})`;
  drawerRefs.fOpen.setAttribute('aria-pressed', String(S.filter === 'open'));
  drawerRefs.fAll.setAttribute('aria-pressed', String(S.filter === 'all'));
  drawerRefs.resolved.checked = S.showResolved;
  const lis = items.map((th) =>
    h(
      'li',
      null,
      h(
        'button',
        {
          type: 'button',
          class: `acr-item${th.resolved ? ' acr-is-resolved' : ''}`,
          'data-acr-id': th.id,
          onclick: () => goTo(th.id),
        },
        h('span', { class: 'acr-badge', 'aria-hidden': 'true' }, th.pending ? '…' : String(th.num)),
        h(
          'span',
          { class: 'acr-item-main' },
          h(
            'span',
            { class: 'acr-item-top' },
            h('span', { class: 'acr-sr' }, `#${th.num} `),
            h('bdi', { class: 'acr-author' }, th.author),
            h('span', { class: 'acr-time' }, relTime(th.created)),
            h('span', { class: `acr-chip${th.resolved ? ' acr-is-resolved' : ''}` }, th.resolved ? t.statusResolved : t.statusOpen),
          ),
          h('span', { class: 'acr-item-text', dir: 'auto' }, firstLine(th.text)),
          th.anchor && th.anchor.snippet ? h('span', { class: 'acr-item-snip', dir: 'auto' }, `${t.element}: ${th.anchor.snippet}`) : null,
          th.replies.length ? h('span', { class: 'acr-item-replies' }, t.replies(th.replies.length)) : null,
        ),
      ),
    ),
  );
  if (!lis.length) lis.push(h('li', { class: 'acr-empty' }, all.length ? t.emptyOpen : t.empty));
  drawerRefs.list.replaceChildren(...lis);
}

function buildDrawer() {
  const t = T();
  const title = h('h2', { class: 'acr-h acr-grow', id: 'acr-drawer-title' });
  const close = iconButton('close', t.close, () => closeDrawer());
  const fOpen = h('button', { type: 'button', class: 'acr-btn acr-btn-sm acr-btn-ghost', onclick: () => setFilter('open') }, t.filterOpen);
  const fAll = h('button', { type: 'button', class: 'acr-btn acr-btn-sm acr-btn-ghost', onclick: () => setFilter('all') }, t.filterAll);
  const resolved = h('input', { type: 'checkbox', id: 'acr-show-resolved' });
  resolved.addEventListener('change', () => {
    S.showResolved = resolved.checked;
    store.set(LS.resolved, S.showResolved ? '1' : '0');
    renderPins();
  });
  const list = h('ul', { class: 'acr-list', 'aria-labelledby': 'acr-drawer-title' });
  const name = h('bdi', { class: 'acr-author' });
  const changeName = h('button', { type: 'button', class: 'acr-link', onclick: () => askName(true) }, t.changeName);
  const exJson = h('button', { type: 'button', class: 'acr-btn acr-btn-sm acr-btn-ghost', onclick: () => doExport('json') }, icon('download'), t.exportJson);
  const exCsv = h('button', { type: 'button', class: 'acr-btn acr-btn-sm acr-btn-ghost', onclick: () => doExport('csv') }, icon('download'), t.exportCsv);
  const nameLabel = h('span', { class: 'acr-muted' }, t.yourName);
  const filterGroup = h('div', { class: 'acr-seg', role: 'group', 'aria-label': t.filterLabel }, fOpen, fAll);
  const resolvedLabel = h('span', null, t.showResolved);
  drawer.replaceChildren(
    h('div', { class: 'acr-drawer-head' }, title, close),
    h('div', { class: 'acr-controls' }, filterGroup, h('label', { class: 'acr-check', for: 'acr-show-resolved' }, resolved, resolvedLabel)),
    list,
    h('div', { class: 'acr-drawer-foot' }, h('div', { class: 'acr-row' }, nameLabel, name, changeName), h('div', { class: 'acr-row' }, exJson, exCsv)),
  );
  drawerRefs = { title, close, fOpen, fAll, resolved, list, name, filterGroup };
  renderDrawerName();
}

function setFilter(f) {
  S.filter = f;
  store.set(LS.filter, f);
  renderList();
}

function openDrawer() {
  if (keepDraft()) return;
  if (S.active) closePopover(false);
  S.drawer = true;
  buildDrawer();
  drawer.hidden = false;
  listBtn.setAttribute('aria-expanded', 'true');
  renderList();
  drawerRefs.close.focus({ preventScroll: true });
}

function closeDrawer(restore = true) {
  if (!S.drawer) return;
  S.drawer = false;
  drawer.hidden = true;
  listBtn.setAttribute('aria-expanded', 'false');
  if (restore) listBtn.focus({ preventScroll: true });
}

// ─────────────────────────────── shell ───────────────────────────────

function applyLang() {
  const t = T();
  root.setAttribute('dir', S.lang === 'he' ? 'rtl' : 'ltr');
  root.setAttribute('lang', S.lang);
  bar.setAttribute('aria-label', t.toolbar);
  modeLabel.textContent = t.comments;
  modeBtn.title = `${S.mode ? t.modeOn : t.modeOff} (C)`;
  listBtn.setAttribute('aria-label', t.list);
  listBtn.title = t.list;
  langBtn.textContent = t.langShort;
  langBtn.setAttribute('aria-label', t.langSwitch);
  langBtn.setAttribute('lang', S.lang === 'he' ? 'ru' : 'he');
  langBtn.title = t.langSwitch;
  exitBtn.setAttribute('aria-label', t.exit);
  exitBtn.title = t.exit;
  hint.textContent = MQ_FINE.matches ? t.hintPointer : t.hintTouch;
  drawer.setAttribute('aria-label', t.list);
  updateCount();
  if (S.drawer) {
    buildDrawer();
    renderList();
  }
  if (S.active) {
    if (S.active.type === 'draft') openDraft(S.active.anchor, popRefs ? popRefs.ta.value : '');
    else openThread(S.active.id, S.returnFocus);
  }
  renderPins();
}

function toggleLang() {
  S.lang = S.lang === 'he' ? 'ru' : 'he';
  store.set(LS.lang, S.lang);
  applyLang();
}

function onKey(e) {
  if (!root) return;
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (S.modal) return;
    if (S.active) {
      e.preventDefault();
      if (!keepDraft()) closePopover();
    } else if (S.drawer) {
      e.preventDefault();
      closeDrawer();
    } else if (S.mode) {
      e.preventDefault();
      setMode(false);
      modeBtn.focus({ preventScroll: true });
    }
    return;
  }
  if ((e.code === 'KeyC' || e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
    if (isEditable(e.target) || S.modal) return;
    e.preventDefault();
    setMode(!S.mode);
  }
}

const onFocus = () => refresh();
const onVisibility = () => {
  if (!document.hidden) refresh();
};
const onMedia = () => {
  if (S.active) placePopover();
  if (root) hint.textContent = MQ_FINE.matches ? T().hintPointer : T().hintTouch;
};

function exitReview() {
  if (keepDraft()) return;
  store.del(LS.key);
  setMode(false);
  closeDrawer(false);
  clearInterval(pollId);
  clearTimeout(toastId);
  removeEventListener('keydown', onKey);
  removeEventListener('focus', onFocus);
  removeEventListener('hashchange', openFromHash);
  document.removeEventListener('visibilitychange', onVisibility);
  MQ_SHEET.removeEventListener('change', onMedia);
  MQ_FINE.removeEventListener('change', onMedia);
  root.remove();
  layer.remove();
  if (cssLink) cssLink.remove();
  HTML.classList.remove('acr-commenting', 'is-review');
  root = null;
  window.__acr = false;
}

function buildUI() {
  root = h('div', { class: `acr-root acr-pdir-${PAGE_DIR}`, 'data-lenis-prevent': '', translate: 'no' });
  modeLabel = h('span', { class: 'acr-tb-label' });
  countEl = h('span', { class: 'acr-count', 'aria-hidden': 'true' });
  modeBtn = h(
    'button',
    { type: 'button', class: 'acr-tb acr-mode', 'aria-pressed': 'false', 'aria-keyshortcuts': 'C', onclick: () => setMode(!S.mode) },
    icon('comment'),
    modeLabel,
    countEl,
  );
  listBtn = h('button', { type: 'button', class: 'acr-tb', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: () => (S.drawer ? closeDrawer() : openDrawer()) }, icon('list'));
  langBtn = h('button', { type: 'button', class: 'acr-tb acr-lang', onclick: toggleLang });
  exitBtn = h('button', { type: 'button', class: 'acr-tb acr-exit', onclick: exitReview }, icon('exit'));
  bar = h('div', { class: 'acr-bar', role: 'toolbar' }, modeBtn, h('span', { class: 'acr-sep', 'aria-hidden': 'true' }), listBtn, langBtn, exitBtn);
  hint = h('div', { class: 'acr-hint', 'aria-hidden': 'true' });
  hover = h('div', { class: 'acr-hover', 'aria-hidden': 'true' });
  pop = h('div', { class: 'acr-pop', role: 'dialog', tabindex: '-1', hidden: true });
  drawer = h('aside', { class: 'acr-drawer', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'acr-drawer-title', hidden: true });
  toastEl = h('div', { class: 'acr-toast', role: 'status', 'aria-live': 'polite' });
  root.append(hover, hint, pop, drawer, bar, toastEl);
  layer = h('div', { class: `acr-layer acr-off acr-pdir-${PAGE_DIR}`, 'aria-label': 'Review pins', translate: 'no' });
  draftPin = h('span', { class: 'acr-pin acr-draft', 'aria-hidden': 'true', style: PIN_PARKED }, '+');
  document.body.append(layer, root);
}

function loadCss() {
  return new Promise((resolve) => {
    const href = new URL('./review.css', import.meta.url).href;
    cssLink = h('link', { rel: 'stylesheet', href, 'data-acr': '' });
    cssLink.addEventListener('load', () => resolve());
    cssLink.addEventListener('error', () => resolve());
    document.head.append(cssLink);
    setTimeout(resolve, 3000);
  });
}

function readKey() {
  let key = null;
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('review')) {
      const k = (url.searchParams.get('review') || '').trim();
      if (k) {
        store.set(LS.key, k);
        key = k;
      }
      url.searchParams.delete('review');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    /* ignore */
  }
  return key || store.get(LS.key);
}

async function start() {
  S.key = readKey();
  if (!S.key || window.__acr) return;
  window.__acr = true;
  S.client = store.get(LS.client);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(S.client || '')) {
    S.client = randId(20);
    store.set(LS.client, S.client);
  }
  await loadCss();
  buildUI();
  applyLang();
  addEventListener('keydown', onKey);
  addEventListener('focus', onFocus);
  addEventListener('hashchange', openFromHash);
  document.addEventListener('visibilitychange', onVisibility);
  MQ_SHEET.addEventListener('change', onMedia);
  MQ_FINE.addEventListener('change', onMedia);
  pollId = setInterval(() => {
    if (!document.hidden) refresh();
  }, POLL_MS);
  await refresh();
}

// Exposed for debugging / tests only.
window.__acrReview = {
  state: S,
  refresh,
  setMode: (on) => setMode(on),
  relTime: (iso) => relTime(iso),
  pageId,
};

start();
