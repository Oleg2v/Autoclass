// Generates docs/copy-ru-he.md: every Hebrew string of the page with its Russian translation.
// Run: npm run copy-doc
import { writeFileSync } from 'node:fs';
import { copy } from '../src/data/copy.js';
import { WHATSAPP_TEXT, BUSINESS } from '../src/data/site.js';

const rows = [];
const walk = (node, path) => {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i + 1}]`));
  if (node && typeof node === 'object') {
    if (typeof node.he === 'string' && typeof node.ru === 'string') {
      rows.push({ path, he: node.he, ru: node.ru, verify: !!node.verify });
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'he' || k === 'ru') continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  }
};
walk(copy, '');

const extra = [
  { path: 'whatsapp.prefill (готовый текст сообщения)', he: WHATSAPP_TEXT, ru: 'Здравствуйте, Авто Класс! Мою машину повредили, и я хочу отправить вам фото повреждения.' },
  { path: 'jsonld.addressRegion', he: 'מחוז תל אביב', ru: 'Тель-Авивский округ' },
  { path: 'jsonld.areaServed', he: 'חולון · גוש דן', ru: 'Холон · Гуш-Дан' },
  { path: 'business.name', he: BUSINESS.nameHe, ru: 'Авто Класс — сервисный центр для автомобилей' },
  { path: 'manifest.short_name', he: 'אוטו קלאס', ru: 'Авто Класс' },
  { path: '404.title', he: 'הדף לא נמצא | אוטו קלאס', ru: 'Страница не найдена | Авто Класс' },
  { path: '404.h1', he: 'הדף הזה לא קיים', ru: 'Такой страницы нет' },
  { path: '404.text', he: 'כל מה שצריך נמצא בעמוד הראשי.', ru: 'Всё нужное — на главной странице.' },
  { path: '404.link', he: 'לעמוד הראשי של אוטו קלאס', ru: 'На главную страницу Авто Класс' },
];

const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# Тексты страницы: иврит → русский\n\n`;
md += `Файл сгенерирован автоматически из \`src/data/copy.js\` командой \`npm run copy-doc\`. `;
md += `Каждая строка на иврите, которая видна на странице или читается скринридером, стоит рядом с полным русским переводом.\n\n`;
md += `⚠️ — формулировка повторяет утверждение с текущего сайта владельца (юридическое/финансовое или про материалы/персонал) и должна быть подтверждена владельцем.\n\n`;
md += `| # | Ключ | Иврит | Русский |\n|---|---|---|---|\n`;
[...rows, ...extra].forEach((r, i) => {
  md += `| ${i + 1} | \`${r.path}\`${r.verify ? ' ⚠️' : ''} | ${esc(r.he)} | ${esc(r.ru)} |\n`;
});
md += `\nВсего строк: ${rows.length + extra.length}.\n`;
writeFileSync(new URL('../docs/copy-ru-he.md', import.meta.url), md);
console.log(`docs/copy-ru-he.md: ${rows.length + extra.length} strings`);
