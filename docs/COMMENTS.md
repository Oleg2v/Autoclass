# Review comments (Figma-style notes on the live page)

The agency (Russian-speaking) and the shop owner (Hebrew-speaking) can pin notes directly on
elements of the live site, reply, and mark them resolved. No accounts are needed: whoever has the
review link can comment, and each person types a name once.

## How it works

```
page (any visitor)          inline loader: does nothing unless ?review=… or localStorage 'acr-key'
   │ review mode
   ▼
/review/review.js + .css    vanilla ES module widget, no dependencies, no build step (public/review/)
   │ fetch /api/comments/*  header X-Review-Key
   ▼
Pages Function              functions/api/comments/[[path]].js forwards to the COMMENTS service binding
   ▼
Worker autoclass-comments   workers/comments: validation, auth, notifications
   ▼
Durable Object (SQLite)     CommentsRoom: threads, replies, per-page numbering, rate limit
```

Normal visitors download nothing: the loader is a few hundred bytes of inline script that only
injects `/review/review.js` after `load`, and only in review mode.

### The loader (already in the page `<head>`)

```html
<script>(()=>{try{const k=new URLSearchParams(location.search).get('review');if(k)localStorage.setItem('acr-key',k);if(k||localStorage.getItem('acr-key'))addEventListener('load',()=>{const s=document.createElement('script');s.type='module';s.src='/review/review.js';document.head.append(s)})}catch(e){}})()</script>
```

The site's `Base.astro` uses a variant that also adds `html.is-review`. The widget removes that
class again when someone leaves review mode.

## Opening the review link

1. Get the key: it is the `REVIEW_KEY` secret of the `autoclass-comments` Worker
   (see `workers/comments/README.md` to create or rotate it).
2. Share `https://autoclass.kikkey.com/?review=<KEY>`.
3. On first open, the key is stored in `localStorage` (`acr-key`) and removed from the address bar,
   so later visits from the same browser stay in review mode without the parameter.
4. To leave review mode on a device, use the exit button in the toolbar
   (יציאה ממצב סקירה / Выйти). It clears the stored key and removes the widget.

To revoke access for everyone, rotate the key: `npx wrangler secret put REVIEW_KEY`. Old links
then get a "wrong key" toast.

## Using it

The toolbar sits bottom-left (the inline end of the RTL page). It has five controls:

| Control | What it does |
| --- | --- |
| **הערות / Комментарии** | Toggles comment mode. The shortcut is **C**. The badge shows how many threads are open. |
| List icon | Opens the list of every thread, with filters, a "show resolved pins" toggle, a name change, and JSON/CSV export. |
| **RU / עב** | Switches the widget language. The choice is remembered. |
| Exit icon | Leaves review mode. |

- **View mode** (the default): the page behaves normally and no pins are shown.
- **Comment mode**:
  - Pins appear.
  - Links, buttons, and forms on the page don't act.
  - On desktop the cursor becomes a crosshair, and an outline previews the element that will be anchored.
  - Click or tap anywhere to drop a pin and write a note. Press Ctrl/Cmd+Enter to send.
  - The first time someone posts, they are asked for a name. It is stored in `acr-name` and can be changed from the list.
  - **Esc** closes the open popover, then the list, then leaves comment mode.
  - Typed text is not lost by accident. With an unsent new comment, a click elsewhere on the page
    only flashes the composer. Esc, the comment-mode button, the list, or exit first flash it and
    show a hint; doing it again within 4 seconds discards the comment. Unsent reply text stays with
    its thread when the popover closes (the pin shows a small white dot) and comes back when the
    thread is reopened.
- **Pins**:
  - Lime pins are open threads. Grey pins are resolved, and they stay hidden unless "show resolved" is on.
  - Click a pin to read the thread, reply, mark it resolved (סימון כנפתרה / Решено) or reopen it.
    The spec said "סמן כפתור"; it was changed because without vowels it reads as "mark button".
    Confirm the wording with the owner.
  - You can delete your own message while nobody has replied after it.
  - On phones (≤ 640px) the thread opens as a bottom sheet (at most 60% of the screen), and the
    page scrolls so the pin and its element stay visible above it.
- **Dashed pin**: the element is not visible at this screen size (for example, a desktop-only block
  seen on a phone). The pin is then placed at the approximate page position it had when it was created.
- Threads refresh every 20 seconds while the tab is visible, and again when the tab regains focus.

### How pins stay on their element

Each note stores a CSS selector for the clicked element. The selector starts from the closest
ancestor with `data-cid="…"` (or a unique `id`) and adds a short `:nth-of-type` path of at most four
levels. The note also stores the click position inside that element, in percent and measured from
the element's inline-start edge (its right edge on this RTL page). When the layout changes, for
example between desktop and phone, the pin is re-placed on the same element at the same relative spot.

**Give important blocks a `data-cid` attribute.** It keeps their notes anchored even if the markup
around them changes. A page other than `/` gets its own thread list (`page` = path, `home` for `/`).
Override it with `<html data-acr-page="…">` if needed.

## Notifications

Each new thread and each reply triggers a notification. It is sent in the background, so a failed
notification never blocks posting (failures are only logged).

- **ntfy** (push to phone and desktop): set the Worker secret `NTFY_TOPIC` to a long, random topic
  name, then subscribe to that topic in the ntfy app (iOS/Android) or at `https://ntfy.sh/<topic>`.
  - Each message title reads like `Auto Class: new comment #3 by דנה`. The text and the element
    snippet go in the body. The worker uses ntfy's JSON API, so Hebrew and Russian come through intact.
  - Tapping the notification opens the page in review mode, scrolled to the pin with its thread open
    (`/?review=<KEY>#acr-<id>`).
  - Topic names on ntfy.sh are public to anyone who knows them, and the link includes the review key,
    so do not use a guessable topic.
- **E-mail**: also set `NOTIFY_EMAIL`, and ntfy.sh forwards every notification to that address.
  ntfy.sh limits how many e-mails anonymous publishers may send per day, so treat it as best effort.
- **Webhook**: set `WEBHOOK_URL`.
  - A normal URL receives `POST {event, thread, reply, url}`, where `event` is `thread.created` or
    `reply.created`.
  - A Telegram Bot API URL such as `https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat>`
    receives a ready-made text message instead.

Set the secrets with `npx wrangler secret put <NAME>` in `workers/comments/`.

## Exporting comments

- In the widget: open the list, then **ייצוא JSON / Экспорт JSON** or **ייצוא CSV / Экспорт CSV**.
- From a terminal:

  ```sh
  curl -H "X-Review-Key: $KEY" "https://autoclass.kikkey.com/api/comments/export?format=csv" -o comments.csv
  curl -H "X-Review-Key: $KEY" "https://autoclass.kikkey.com/api/comments/export?format=json" -o comments.json
  ```

The CSV has one row per message, with its page, number, status, resolver, selector and element
snippet. It is UTF-8 with a BOM, so Excel shows Hebrew and Russian correctly. The JSON is the full
thread structure. Both include every page.

## Privacy and safety notes

- **Access**: anyone with the key can read, write and export. Share the link only with the agency
  and the owner, and rotate the key when the review is over.
- **Text handling**: names and texts are stored as typed and always rendered as plain text
  (`textContent`), never as HTML.
- **Deleting**: each browser gets a random `acr-client` id. Only that browser can delete its own
  messages, and only while nobody has replied after them.
- **Rate limit**: 30 writes per minute per IPv4 address or per IPv6 /64 network, and 200 writes per
  minute in total. This also caps how many notifications can be sent.
- **Review key**: must be printable ASCII (no spaces, no Hebrew). Surrounding spaces from copy-paste
  are trimmed; any other key is reported as a wrong key.
- **Widget isolation**:
  - The widget's styles are scoped (`.acr-root`, `.acr-layer`, and `html.acr-commenting` in comment mode).
  - It sets its own font, box model and resets, so page CSS does not leak into it.
  - It adds nothing to the page in view mode beyond the toolbar.
