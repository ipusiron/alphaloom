// URL の「#」より後ろ（または「?」より後ろ）で暗号文と鍵の長さを受け取る（ほかのツールから渡して開くため）。例: #text=LXFOPVEFRNHR&n=5
// Day030 Modular Text Divider と同じ形。text は最初の10,000字まで、n は1〜20の整数（それ以外は無視）

export const MAX_PARAM_TEXT = 10000;

// 「#」より後ろ（サーバーへ送られず、URLの長さの上限もない）を優先し、なければ「?」から読む。n も同じ場所から読む
export function readParams(search, hash = '') {
  const fromHash = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const q = fromHash.has('text') ? fromHash : new URLSearchParams(search || '');
  const raw = q.get('text');
  const text = raw !== null && raw.trim() ? raw.slice(0, MAX_PARAM_TEXT) : null;
  const rawN = q.get('n');
  const n = rawN !== null && /^\d{1,2}$/.test(rawN) && Number(rawN) >= 1 && Number(rawN) <= 20 ? Number(rawN) : null;
  return { text, n };
}

// 読み込んだ text と n を「?」と「#」の両方から消したときのパス。どちらもなければ null。
// アドレスバー・ブックマーク・URL のコピーに暗号文を残さないため（Day017・Day030 と同じ）
export function urlWithoutHandoff(href) {
  const url = new URL(href);
  const fromHash = new URLSearchParams(url.hash.slice(1));
  const keys = ['text', 'n'];
  const inHash = keys.some((k) => fromHash.has(k));
  if (!inHash && !keys.some((k) => url.searchParams.has(k))) return null;
  for (const k of keys) {
    url.searchParams.delete(k);
    fromHash.delete(k);
  }
  const hash = inHash ? fromHash.toString() : url.hash.slice(1);
  return url.pathname + url.search + (hash ? `#${hash}` : '');
}
