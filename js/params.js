// URL のクエリーで暗号文と鍵の長さを受け取る（ほかのツールから渡して開くため）。例: ?text=LXFOPVEFRNHR&n=5
// Day030 Modular Text Divider と同じ形。text は最初の10,000字まで、n は1〜20の整数（それ以外は無視）

export const MAX_PARAM_TEXT = 10000;

export function readParams(search) {
  const q = new URLSearchParams(search || '');
  const raw = q.get('text');
  const text = raw !== null && raw.trim() ? raw.slice(0, MAX_PARAM_TEXT) : null;
  const rawN = q.get('n');
  const n = rawN !== null && /^\d{1,2}$/.test(rawN) && Number(rawN) >= 1 && Number(rawN) <= 20 ? Number(rawN) : null;
  return { text, n };
}
