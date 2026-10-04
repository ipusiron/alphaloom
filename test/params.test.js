import test from 'node:test';
import assert from 'node:assert/strict';
import { readParams, urlWithoutHandoff, MAX_PARAM_TEXT } from '../js/params.js';

test('?text= と ?n= で暗号文と鍵の長さを受け取る（Day030 と同じ形）。範囲外の n は無視', () => {
  assert.deepEqual(readParams('?text=LXFOPVEFRNHR&n=5'), { text: 'LXFOPVEFRNHR', n: 5 });
  assert.deepEqual(readParams('?text=abc%20def'), { text: 'abc def', n: null });
  for (const n of ['0', '21', '-1', '2.5', 'x', '005']) assert.equal(readParams(`?text=A&n=${n}`).n, null, n);
  assert.deepEqual(readParams('?n=5'), { text: null, n: 5 });
  assert.deepEqual(readParams('?text=%20%20'), { text: null, n: null });
  assert.deepEqual(readParams(''), { text: null, n: null });
  assert.equal(readParams(`?text=${'A'.repeat(20000)}`).text.length, MAX_PARAM_TEXT);
});

test('#text= を先に読み、n も同じ場所から読む。なければ ?text= から', () => {
  assert.deepEqual(readParams('?text=QUERY&n=3', '#text=HASH&n=5'), { text: 'HASH', n: 5 });
  assert.deepEqual(readParams('?text=QUERY&n=3', ''), { text: 'QUERY', n: 3 });
  assert.equal(readParams('', `#text=${'A'.repeat(20000)}`).text.length, MAX_PARAM_TEXT);
  assert.deepEqual(readParams('?lang=en', '#top'), { text: null, n: null });
});

test('読み込んだ text と n は「?」と「#」の両方から消す（lang などほかの値は残す）', () => {
  const base = 'https://ipusiron.github.io/alphaloom/';
  assert.equal(urlWithoutHandoff(`${base}?text=ABC&n=3&lang=en`), '/alphaloom/?lang=en');
  assert.equal(urlWithoutHandoff(`${base}?lang=en#text=ABC&n=3`), '/alphaloom/?lang=en');
  assert.equal(urlWithoutHandoff(`${base}#text=ABC&x=1`), '/alphaloom/#x=1');
  assert.equal(urlWithoutHandoff(`${base}?text=ABC#top`), '/alphaloom/#top');
  assert.equal(urlWithoutHandoff(`${base}?lang=en#top`), null);
});
