import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWordList, buildColumns, parsePattern, countCombinations, scoreDictionary, keyLogWeight, formatShare } from '../js/loom-core.js';
import { BUILTIN_WORDS, BUILTIN_FILE, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS } from '../js/wordlists.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const md = read('README.md');
const fmt = (n) => n.toLocaleString('en-US');
const lists = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, parseWordList(read(w.file))]));
const defaultWords = [...new Set([...BUILTIN_WORDS, ...DEFAULT_WORDLISTS.flatMap((id) => lists[id].words)])];

function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// firstHeader で始まる表の本体の行（見出しと区切りの行を除く）を、セルの配列にする
function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  return rows;
}

const h2 = md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）', () => {
  const m = md.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const yaml = m[1];
  const keys = [...yaml.matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(yaml, new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(yaml, /^id: day046$/m);
  assert.match(yaml, /^slug: alphaloom$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github.com\/ipusiron\/alphaloom"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron.github.io\/alphaloom\/"$/m);
  assert.match(yaml, /^hub: true$/m);
});

test('シリーズ標準の構成（前半と後半の見出しの順、Day の表記、プロジェクトのリンク）', () => {
  assert.match(md, /\n# AlphaLoom - .+\n/);
  assert.ok(md.includes('**Day046 - 生成AIで作るセキュリティツール100**'));
  assert.ok(h2[0].startsWith('🌐'));
  assert.ok(h2[1].startsWith('📸'));
  assert.deepEqual(h2.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
  for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪']) assert.ok(h2.some((h) => h.startsWith(icon)), icon);
  assert.match(section(md, '🛠️ このツールについて'), /https:\/\/akademeia\.info\/\?page_id=42163/);
  for (const b of ['stars', 'forks', 'last-commit', 'license']) assert.ok(md.includes(`img.shields.io/github/${b}/ipusiron/alphaloom`), b);
});

test('強調は1節に2か所まで、箇条書きの項目名を太字にしない', () => {
  for (const h of h2) {
    const n = (section(md, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
    assert.ok(n <= 2, `${h}: ${n}`);
  }
  assert.doesNotMatch(md, /^\s*- \*\*/m);
});

test('辞書の表は wordlists/ の実ファイルと一致する', () => {
  const rows = table(section(md, '📚 辞書'), 'ファイル');
  assert.equal(rows.length, BUNDLED_WORDLISTS.length + 1);
  for (const w of BUNDLED_WORDLISTS) {
    const row = rows.find((r) => r[0] === path.basename(w.file));
    assert.ok(row, w.file);
    assert.equal(row[2], fmt(lists[w.id].lines), `${w.id} lines`);
    assert.equal(row[3], fmt(lists[w.id].words.length), `${w.id} words`);
    assert.equal(row[4], DEFAULT_WORDLISTS.includes(w.id) ? '○' : '', w.id);
  }
  const mini = parseWordList(read(BUILTIN_FILE));
  const row = rows.find((r) => r[0] === path.basename(BUILTIN_FILE));
  assert.deepEqual(row.slice(2), [fmt(mini.lines), fmt(BUILTIN_WORDS.length), '○（内蔵）']);
  assert.ok(md.includes(`内蔵ミニ辞書（${BUILTIN_WORDS.length}語）`));
});

test('重みと探索の仕組みの表（列の候補→組み合わせの数・辞書の語）は、実装の結果と一致する', () => {
  const sec = section(md, '🔬 重みと探索の仕組み');
  assert.ok(sec.includes(`（内蔵＋english_5067＋english_1842、${fmt(defaultWords.length)}語）`));
  const rows = table(sec, '列の候補');
  assert.equal(rows.length, 2);
  for (const [spec, total, words] of rows) {
    const cols = spec.endsWith('（パターン）') ? buildColumns(parsePattern(spec.replace('（パターン）', '')))
      : buildColumns(spec.split('・').map((s) => (s === '空欄' ? '' : s)));
    assert.equal(total, `${fmt(Number(countCombinations(cols)))}通り`, spec);
    const dict = scoreDictionary(cols, defaultWords);
    const want = dict.map((d) => (words.includes('%') ? `${d.word} ${formatShare(d.logw)}` : d.word)).join(', ');
    assert.equal(words, want, spec);
  }
  const readmeCols = buildColumns(['THS', 'HEA', 'EAI', '', 'RYS']);
  assert.equal(keyLogWeight(readmeCols, 'THESE'), null);
  const pat = scoreDictionary(buildColumns(parsePattern('?HE??')), defaultWords);
  assert.ok(sec.includes(`${pat.length}語の重みは等しく（${formatShare(pat[0].logw)}）`));
  assert.ok(new Set(pat.map((d) => formatShare(d.logw))).size === 1);
  assert.ok(md.includes(`?HE??なら${pat.length}語`));
});

test('ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある', () => {
  const block = section(md, '📁 ディレクトリー構造').match(/```\n([\s\S]*?)```/)[1];
  const lines = block.split('\n').filter(Boolean).slice(1);
  const listed = new Set();
  for (const line of lines) {
    const m = line.match(/^[│├└─\s]*([^\s#]+)\s+# (.+)$/);
    assert.ok(m, `説明のない行: ${line}`);
    listed.add(m[1].replace(/\/$/, ''));
  }
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((x) => !['.git', 'node_modules', '.claude'].includes(x.name))
    .flatMap((x) => (x.isDirectory() ? [x.name, ...walk(path.join(dir, x.name))] : [x.name]));
  const all = walk('.');
  for (const name of all) assert.ok(listed.has(name), `ツリーにない: ${name}`);
  for (const name of listed) assert.ok(all.includes(name), `実在しない: ${name}`);
  const cols = new Set(lines.map((l) => l.indexOf(' # ')));
  assert.equal(cols.size, 1, [...cols].join(','));
});

test('画像: 参照はすべて実在し、assets/ の PNG は README から参照しているものだけ（300KB以下）', () => {
  const refs = [...md.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
  assert.equal(refs.length, 3);
  for (const r of refs) {
    assert.ok(fs.existsSync(path.join(ROOT, r)), r);
    assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
  }
  const pngs = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.png')).map((f) => `assets/${f}`).sort();
  assert.deepEqual(pngs, [...new Set(refs)].sort());
});

test('ALGORITHM.md の例（THEIR の重み・THESE は作れない・?HE?? の15語・部分文字列171通り）は実装と一致する', () => {
  const doc = read('ALGORITHM.md');
  const cols = buildColumns(['THS', 'HEA', 'EAI', '', 'RYS']);
  assert.ok(doc.includes(`THEIRの重みは\`1/2 × 1/2 × 1/2 × 1/26 × 1/2 ≈ ${formatShare(keyLogWeight(cols, 'THEIR'))}\``));
  assert.equal(keyLogWeight(cols, 'THESE'), null);
  const pat = scoreDictionary(buildColumns(parsePattern('?HE??')), defaultWords);
  assert.ok(doc.includes(`当てはまる辞書の語（${pat.length}語）の重みはどれも\`1/26 × 1 × 1 × 1/26 × 1/26 ≈ ${formatShare(pat[0].logw)}\``));
  assert.ok(doc.includes(`（${fmt(defaultWords.length)}語）では一瞬で終わります`));
  let subs = 0;
  for (let len = 3; len <= 20; len++) subs += 20 - len + 1;
  assert.ok(doc.includes(`文字数20なら${subs}通り`));
});
