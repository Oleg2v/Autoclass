// Notifications for new threads and replies. Called through ctx.waitUntil, so the
// API response never waits for them; every failure is logged and swallowed.

const DEFAULT_SITE = 'https://autoclass.kikkey.com';

function clip(s, n) {
  s = String(s || '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function threadUrl(env, thread) {
  const site = String(env.PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/+$/, '');
  const path = !thread.page || thread.page === 'home' ? '/' : `/${String(thread.page).replace(/^\/+/, '')}`;
  return `${site}${path}?review=${encodeURIComponent(env.REVIEW_KEY || '')}#acr-${thread.id}`;
}

export function buildMessage(event, thread, reply) {
  const isReply = event === 'reply.created';
  const author = isReply ? reply.author : thread.author;
  const title = isReply
    ? `Auto Class: reply on #${thread.num} by ${author}`
    : `Auto Class: new comment #${thread.num} by ${author}`;
  const lines = [clip(isReply ? reply.text : thread.text, 1500)];
  if (isReply) lines.push('', `#${thread.num} (${thread.author}): ${clip(thread.text, 200)}`);
  if (thread.anchor && thread.anchor.snippet) lines.push('', `[${clip(thread.anchor.snippet, 120)}]`);
  return { title, message: lines.join('\n') };
}

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${new URL(url).host} answered ${res.status} ${clip(detail, 200)}`);
  }
  return res;
}

// ntfy JSON publish API (UTF-8 safe, unlike HTTP header titles).
async function sendNtfy(env, msg, click) {
  const server = String(env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const payload = {
    topic: env.NTFY_TOPIC,
    title: msg.title,
    message: msg.message,
    tags: ['speech_balloon'],
    click,
  };
  if (env.NOTIFY_EMAIL) payload.email = env.NOTIFY_EMAIL;
  await post(`${server}/`, payload);
}

async function sendWebhook(env, event, thread, reply, msg, click) {
  const target = new URL(env.WEBHOOK_URL);
  if (target.hostname === 'api.telegram.org') {
    // WEBHOOK_URL = https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>
    if (!/\/sendMessage$/.test(target.pathname)) target.pathname = `${target.pathname.replace(/\/+$/, '')}/sendMessage`;
    const chatId = target.searchParams.get('chat_id');
    target.searchParams.delete('chat_id');
    await post(target.toString(), {
      chat_id: chatId,
      text: `${msg.title}\n\n${msg.message}\n\n${click}`,
      disable_web_page_preview: true,
    });
    return;
  }
  await post(target.toString(), { event, thread, reply: reply || null, url: click });
}

export async function notify(env, event, thread, reply = null) {
  const jobs = [];
  try {
    const msg = buildMessage(event, thread, reply);
    const click = threadUrl(env, thread);
    if (env.NTFY_TOPIC) jobs.push(sendNtfy(env, msg, click));
    if (env.WEBHOOK_URL) jobs.push(sendWebhook(env, event, thread, reply, msg, click));
  } catch (err) {
    console.error('notify: could not build notification', err);
    return;
  }
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === 'rejected') console.error('notify failed:', r.reason && r.reason.message ? r.reason.message : r.reason);
  }
}
