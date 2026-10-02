import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MESSAGES } from '../js/messages.js';
import { detectLanguage } from '../js/i18n.js';

// かな・カタカナ・漢字・全角の記号（英語の文言に入っていないこと）
const JP = new RegExp('[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('日本語と英語の辞書は同じキーを持ち、置き場所（{name}）もそろう', () => {
  const ja = Object.keys(MESSAGES.ja).sort();
  const en = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(en, ja);
  for (const k of ja) assert.deepEqual(placeholders(MESSAGES.en[k]), placeholders(MESSAGES.ja[k]), k);
});

test('英語の文言に日本語の文字がない（言語の切り替えボタンの「日本語」だけは例外）', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'ui.langButton' || k === 'ui.switchLang') continue;
    assert.doesNotMatch(v, JP, `${k}: ${v}`);
  }
  assert.equal(MESSAGES.en['ui.langButton'], '日本語');
  assert.equal(MESSAGES.ja['ui.langButton'], 'EN');
});

test('index.html の data-i18n と data-i18n-attr のキーは、すべて辞書にある。本文の日本語はすべてキーを持つ', () => {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const attrs = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((p) => p.split(':')[1]));
  assert.ok(keys.length >= 70, String(keys.length));
  for (const k of [...keys, ...attrs]) {
    assert.ok(MESSAGES.ja[k], k);
    assert.ok(MESSAGES.en[k], k);
  }
  // header から footer まで: 日本語の文字を含む本文は、直前の開きタグに data-i18n がある
  const body = html.slice(html.indexOf('<header'), html.indexOf('</footer>'));
  for (const m of body.matchAll(/(<[^<>]*>)([^<>]+)</g)) {
    if (!JP.test(m[2])) continue;
    assert.match(m[1], /data-i18n="/, m[2].trim());
  }
  for (const m of html.matchAll(/(placeholder|aria-label)="([^"]*)"/g)) {
    if (!JP.test(m[2])) continue;
    const tag = html.slice(html.lastIndexOf('<', m.index), html.indexOf('>', m.index) + 1);
    assert.ok(tag.includes('data-i18n-attr=') || tag.includes('id="btnTheme"'), tag);
  }
});

test('file:// の案内と noscript は日本語と英語の両方を持つ', () => {
  assert.match(html, /<div data-lang="ja">/);
  assert.match(html, /<div data-lang="en" hidden>/);
  assert.match(html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>')), /This tool needs JavaScript/);
});

test('初期の言語: ?lang= → 保存した選択 → ブラウザーの言語（日本語以外は英語）', () => {
  assert.equal(detectLanguage('?lang=en', 'ja', 'ja-JP'), 'en');
  assert.equal(detectLanguage('?lang=ja', 'en', 'en-US'), 'ja');
  assert.equal(detectLanguage('', 'en', 'ja-JP'), 'en');
  assert.equal(detectLanguage('?lang=fr', null, 'ja'), 'ja');
  assert.equal(detectLanguage('', null, 'fr-FR'), 'en');
  assert.equal(detectLanguage('', 'xx', ''), 'en');
});
