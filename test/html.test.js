import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SCRIPTS = ['script.js', 'js/tabs.js', 'js/theme.js', 'js/theme-init.js', 'js/file-check.js', 'js/params.js'];

test('CSP: インラインのスクリプト・スタイルを許さず、外部への送信先を持たない', () => {
  const m = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(m);
  const csp = m[1];
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(!csp.includes('unsafe-eval'));
  assert.ok(!csp.includes('frame-ancestors'));
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
});

test('インラインのイベントハンドラー・style 属性・インラインのスクリプトがない（隠す要素は hidden 属性）', () => {
  assert.doesNotMatch(html, /\son[a-z]+="/i);
  assert.doesNotMatch(html, /\sstyle="/i);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.match(m[1], /src="/);
    assert.equal(m[2].trim(), '');
  }
  for (const id of ['resultsSection', 'dictSection', 'cipherSection']) assert.match(html, new RegExp(`id="${id}"[^>]*hidden`), id);
  for (const f of SCRIPTS) assert.doesNotMatch(read(f), /style="|\.cssText|setAttribute\('style'|\.style\.|onclick|onchange|alert\(|confirm\(/, f);
});

test('読み込み順: テーマの初期化はスタイルより前、本体は module、file:// の案内は通常スクリプト', () => {
  const order = ['js/theme-init.js', 'style.css', './script.js'].map((s) => html.indexOf(s));
  assert.ok(order.every((i) => i > 0));
  assert.ok(order[0] < order[1] && order[1] < order[2]);
  assert.match(html, /<script type="module" src="\.\/script.js"><\/script>/);
  assert.match(html, /<script src="js\/file-check.js" defer><\/script>/);
  assert.match(html, /<noscript>/);
  assert.match(read('script.js'), /setAttribute\('data-ready', 'true'\)/);
});

test('画面の要素の id がそろっている（それぞれ1つだけ）', () => {
  const ids = ['fileNotice', 'btnTheme', 'tab-generator', 'tab-dictionary', 'tab-about', 'panel-generator', 'panel-dictionary', 'panel-about',
    'formGen', 'keyLength', 'pattern', 'applyPatternBtn', 'columnsContainer', 'keep', 'runBtn', 'clearBtn', 'status', 'resultsSection',
    'summaryLine', 'staleNote', 'equalNote', 'partialCheck', 'resultInfo', 'resultTable', 'moreBtn', 'exportTxtBtn', 'exportCsvBtn', 'exportJsonBtn',
    'exportInfo', 'dictSection', 'dictSummary', 'dictTable', 'exportDictCsvBtn', 'exportDictJsonBtn', 'dictProtocolNote', 'dictListContainer',
    'dictStatus', 'wordCount', 'wordlistFile', 'loadWordlistBtn', 'pasteWords', 'addPastedBtn',
    'formCipher', 'cipherText', 'cipherKeyLength', 'estimateBtn', 'estimateResult', 'perColumn', 'analyzeBtn', 'clearCipherBtn', 'cipherStatus',
    'cipherSection', 'cipherSummary', 'cipherAccuracy', 'cipherTable', 'cipherInfo', 'columnRankTable', 'exportCipherCsvBtn', 'exportCipherJsonBtn',
    'cipherLinks'];
  for (const id of ids) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
});

test('タブは role=tablist／tab／tabpanel の組で、aria-controls と aria-labelledby が対応する', () => {
  assert.match(html, /<div class="tab-nav" role="tablist" aria-label="[^"]+"[^>]*>/);
  const re = /<button type="button" role="tab" id="(tab-[\w-]+)"[^>]*\s+aria-controls="(panel-[\w-]+)" aria-selected="(true|false)"/g;
  const tabs = [...html.matchAll(re)];
  assert.equal(tabs.length, 3);
  assert.equal(tabs.filter((m) => m[3] === 'true').length, 1);
  for (const [, tab, panel] of tabs) {
    assert.match(html, new RegExp(`<section id="${panel}" class="tab-content" role="tabpanel" aria-labelledby="${tab}"`));
  }
});

test('ボタンには type、入力欄にはラベル（列の欄は JS で label を付ける）、外部リンクには noopener noreferrer、状態の表示は aria-live', () => {
  for (const m of html.matchAll(/<button\b[^>]*>/g)) assert.match(m[0], /type="(button|submit)"/, m[0]);
  for (const m of html.matchAll(/<(input|textarea|select)\b[^>]*id="([^"]+)"/g)) {
    if (m[0].includes('type="checkbox"')) continue;
    assert.match(html, new RegExp(`<label for="${m[2]}"[ >]`), m[2]);
  }
  assert.match(read('script.js'), /el\('label', \{ htmlFor: id/);
  for (const m of html.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)) assert.match(m[0], /rel="noopener noreferrer"/, m[0]);
  for (const id of ['status', 'dictStatus', 'exportInfo', 'cipherStatus', 'estimateResult']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-live="polite"`), id);
  }
  assert.match(read('script.js'), /target: '_blank', rel: 'noopener noreferrer'/);
});

test('画面の組み立てに innerHTML を使わない（辞書名・鍵はすべて textContent）', () => {
  for (const f of SCRIPTS) assert.doesNotMatch(read(f), /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML/, f);
});

test('付属辞書は一覧のパスだけを読み、自由なパスの入力欄はない。最大展開・ビーム幅の欄もない', () => {
  assert.doesNotMatch(html, /id="wordlistPath"|fetchWordlistBtn|id="maxExpand"|id="beamWidth"/);
  const fetches = [...read('script.js').matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(fetches, ['source.file']);
});
