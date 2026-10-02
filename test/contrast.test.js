import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// style.css の色の変数（ライトと、ダークの上書き）を読み、WCAG のコントラスト比を計算する
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');

function vars(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, selector);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const light = vars(':root {');
const dark = { ...light, ...vars(':root[data-theme="dark"] {') };
const media = { ...light, ...vars(':root:not([data-theme="light"]) {') };

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// 文字（4.5:1）。背景のグラデーションの両端（bg-from・bg-to）に載る文字も含める
const TEXT = [
  ['text', 'card'], ['text', 'surface'], ['text', 'bg-from'], ['text', 'bg-to'], ['text', 'indicator-bg'],
  ['muted', 'card'], ['muted', 'surface'], ['muted', 'bg-from'], ['muted', 'bg-to'], ['muted', 'indicator-bg'],
  ['accent', 'card'], ['accent', 'surface'], ['accent', 'indicator-bg'], ['accent', 'bg-from'], ['accent', 'bg-to'],
  ['on-accent', 'accent'], ['on-accent', 'accent-hover'], ['error', 'card'], ['error', 'surface'], ['note-text', 'note-bg']
];
// 入力欄・ボタンの枠線（非テキスト、3:1）
const UI = [['border', 'card'], ['border', 'surface']];

test('計算の確かめ: 白と黒は21:1、同じ色は1:1', () => {
  assert.equal(Math.round(ratio('#ffffff', '#000000')), 21);
  assert.equal(ratio('#1e40af', '#1e40af'), 1);
});

for (const [name, pal] of [['ライト', light], ['ダーク', dark], ['OS のダーク設定', media]]) {
  test(`${name}: 文字は4.5:1以上、枠線は3:1以上`, () => {
    for (const [fg, bg] of TEXT) assert.ok(ratio(pal[fg], pal[bg]) >= 4.5, `${fg} on ${bg}: ${ratio(pal[fg], pal[bg]).toFixed(2)}`);
    for (const [fg, bg] of UI) assert.ok(ratio(pal[fg], pal[bg]) >= 3, `${fg} on ${bg}: ${ratio(pal[fg], pal[bg]).toFixed(2)}`);
  });
}

test('ダークの上書きは、明示の切り替えと OS の設定とで同じ値', () => {
  assert.deepEqual(vars(':root[data-theme="dark"] {'), vars(':root:not([data-theme="light"]) {'));
  for (const k of Object.keys(light)) assert.ok(k in vars(':root[data-theme="dark"] {'), k);
});

test('入力欄の文字は16px以上、操作の高さは44px以上', () => {
  assert.match(css, /textarea \{[^}]*font-size: 16px;/);
  for (const sel of ['.btn {', '.tab-btn {', '.icon-btn {', '.check {', '.dict-checkbox {']) {
    const i = css.indexOf(sel);
    assert.ok(i >= 0, sel);
    const body = css.slice(i, css.indexOf('}', i));
    assert.match(body, /min-height: 44px;/, sel);
  }
});

test('ヘッダーのボタン（言語・テーマ）は高さを固定し、並びの容器に引き伸ばされない', () => {
  const body = css.slice(css.indexOf('.icon-btn {'), css.indexOf('}', css.indexOf('.icon-btn {')));
  assert.match(body, /^\s+height: 44px;$/m);
  assert.match(body, /flex: none;/);
  assert.match(body, /white-space: nowrap;/);
  assert.match(css, /\.header-actions \{ display: flex; align-items: center;/);
});
