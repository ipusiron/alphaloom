// =========================
// AlphaLoom - 初期版スクリプト
// =========================

// ---------- ユーティリティ ----------
const AZ = Array.from({length:26}, (_,i)=>String.fromCharCode(65+i));

function sanitizeLetters(s){
  if(!s) return "";
  return (s.toUpperCase().match(/[A-Z]/g) || []).join("");
}
function dedupePreserveOrder(s){
  const seen=new Set();
  let out="";
  for(const ch of s){
    if(!seen.has(ch)){ seen.add(ch); out+=ch; }
  }
  return out;
}
function linearProbabilities(chars){
  // 先頭ほど重い：w_i = N - i → 正規化
  const N = chars.length;
  const denom = N*(N+1)/2;
  return chars.map((ch,i)=>({ ch, p: (N - i)/denom }));
}
function uniformAZ(){
  const p = 1/26;
  return AZ.map(ch=>({ch, p}));
}
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }

// ---------- DOM 取得 ----------
const keyLengthSel = document.getElementById("keyLength");
const columnsContainer = document.getElementById("columnsContainer");
const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const beamWidthInput = document.getElementById("beamWidth");
const maxExpandInput = document.getElementById("maxExpand");

const groupHigh = document.getElementById("groupHigh");
const groupMid  = document.getElementById("groupMid");
const groupLow  = document.getElementById("groupLow");
const summaryLine = document.getElementById("summaryLine");

const dictFilterBtn = document.getElementById("dictFilterBtn");
const partialCheck = document.getElementById("partialCheck");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportInfo = document.getElementById("exportInfo");

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-content").forEach(el=>{
      el.classList.toggle("active", el.dataset.tab===tab);
    });
  });
});

// 鍵長プルダウン生成
(function initKeyLength(){
  for(let i=1;i<=20;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    keyLengthSel.appendChild(opt);
  }
})();
keyLengthSel.addEventListener("change", onKeyLengthChange);

function onKeyLengthChange(){
  columnsContainer.innerHTML = "";
  const L = parseInt(keyLengthSel.value || "0", 10);
  if(!L) return;
  for(let i=0;i<L;i++){
    const box = document.createElement("div");
    box.className = "col-box";
    const title = document.createElement("h4");
    title.textContent = `列${i+1}`;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "例) CAB / X （空欄可）";
    input.maxLength = 50;
    input.addEventListener("input", ()=>{
      const before = input.value;
      let s = sanitizeLetters(before);
      s = dedupePreserveOrder(s);
      if(s !== before) input.value = s;
    });
    box.appendChild(title);
    box.appendChild(input);
    columnsContainer.appendChild(box);
  }
}

// ---------- 候補列の取得 ----------
function getColumns(){
  const L = parseInt(keyLengthSel.value || "0", 10);
  if(!L) return [];
  const inputs = Array.from(columnsContainer.querySelectorAll("input"));
  const cols = inputs.map(inp=>{
    const s = sanitizeLetters(inp.value);
    if(!s){ return uniformAZ(); }
    const uniq = dedupePreserveOrder(s);
    return linearProbabilities(uniq.split(""));
  });
  return cols;
}

// ---------- ビームサーチによる合成 ----------
function generateCandidates(cols, beamWidth=2000, maxExpand=50000){
  // state: { key: "ABC", logp: sum(log p_i) }
  let beam = [{ key:"", logp: 0 }];
  let expandedTotal = 0;

  for(let pos=0; pos<cols.length; pos++){
    const next = [];
    const cand = cols[pos]; // [{ch,p},...]
    for(const st of beam){
      for(const c of cand){
        next.push({
          key: st.key + c.ch,
          logp: st.logp + Math.log(c.p)
        });
        expandedTotal++;
        if(expandedTotal >= maxExpand){
          // 上限到達：現時点のnextで早期打切り
          break;
        }
      }
      if(expandedTotal >= maxExpand) break;
    }
    // 上位 beamWidth だけ残す
    next.sort((a,b)=>b.logp - a.logp);
    beam = next.slice(0, beamWidth);
    if(expandedTotal >= maxExpand) break;
  }
  // ソート済み
  return { list: beam, expandedTotal };
}

function normalizeConfidence(list){
  // p = exp(logp)
  const probs = list.map(it=>Math.exp(it.logp));
  const total = sum(probs);
  return list.map((it,idx)=>({
    key: it.key,
    prob: probs[idx],
    conf: total>0 ? (probs[idx]/total*100) : 0
  }));
}

function groupByConfidence(items){
  // 分位: 上位20%→高、次30%→中、残り→小
  const n = items.length;
  const highEnd = Math.ceil(n*0.2);
  const midEnd = Math.ceil(n*0.5);
  return {
    high: items.slice(0, highEnd),
    mid : items.slice(highEnd, midEnd),
    low : items.slice(midEnd)
  };
}

function renderGroups(groups, label="列重みベース"){
  const fmt = (x)=>x.toFixed(2);
  function render(list, root){
    root.innerHTML = "";
    list.forEach((it, i)=>{
      const div = document.createElement("div");
      div.className = "result-item";
      const left = document.createElement("div");
      left.className = "kv";
      left.textContent = it.key;
      const right = document.createElement("div");
      right.innerHTML = `<span class="badge">${fmt(it.conf)}%</span>`;
      div.appendChild(left);
      div.appendChild(right);
      root.appendChild(div);
    });
  }
  render(groups.high, groupHigh);
  render(groups.mid, groupMid);
  render(groups.low, groupLow);
  summaryLine.textContent = `${label}：候補 ${groups.high.length + groups.mid.length + groups.low.length} 件`;
}

// ---------- 実行ボタン ----------
let lastRawList = [];     // [{key, prob, conf}]
let lastRankedGroups = null;

// 初期レンダリングをクリアするため
function clearResults(){
  groupHigh.innerHTML = "";
  groupMid.innerHTML = "";
  groupLow.innerHTML = "";
  summaryLine.textContent = "";
  exportInfo.textContent = "";
  lastRawList = [];
  lastRankedGroups = null;
}

runBtn.addEventListener("click", ()=>{
  clearResults();
  const cols = getColumns();
  if(!cols.length){
    alert("鍵文字数を選択してください。");
    return;
  }
  const beamWidth = Math.max(1, parseInt(beamWidthInput.value || "2000", 10));
  const maxExpand = Math.max(1, parseInt(maxExpandInput.value || "50000", 10));

  const { list, expandedTotal } = generateCandidates(cols, beamWidth, maxExpand);
  // 正規化して信頼度%へ
  const norm = normalizeConfidence(list);
  // 高→中→小へ
  const groups = groupByConfidence(norm);
  renderGroups(groups, "列重みベース");
  lastRawList = norm;
  lastRankedGroups = groups;
});

// クリア
clearBtn.addEventListener("click", ()=>{
  columnsContainer.innerHTML = "";
  keyLengthSel.value = "";
  clearResults();
});

// ========== 辞書 ==========

// 内蔵ミニ辞書（約200語 / 頻出語寄り）
const BUILTIN_MINI = `
THE
BE
TO
OF
AND
A
IN
THAT
HAVE
I
IT
FOR
NOT
ON
WITH
HE
AS
YOU
DO
AT
THIS
BUT
HIS
BY
FROM
THEY
WE
SAY
HER
SHE
OR
AN
WILL
MY
ONE
ALL
WOULD
THERE
THEIR
WHAT
SO
UP
OUT
IF
ABOUT
WHO
GET
WHICH
GO
ME
WHEN
MAKE
CAN
LIKE
TIME
NO
JUST
HIM
KNOW
TAKE
PEOPLE
INTO
YEAR
YOUR
GOOD
SOME
COULD
THEM
SEE
OTHER
THAN
THEN
NOW
LOOK
ONLY
COME
ITS
OVER
THINK
ALSO
BACK
AFTER
USE
TWO
HOW
OUR
WORK
FIRST
WELL
WAY
EVEN
NEW
WANT
BECAUSE
ANY
THESE
GIVE
DAY
MOST
US
IS
ARE
WERE
WAS
MORE
MANY
LONG
GREAT
MADE
MIGHT
SHOULD
MUST
EVERY
EVER
NEVER
RIGHT
LEFT
DOWN
HIGH
LOW
NEXT
LAST
EARLY
LATE
SMALL
LARGE
OPEN
CLOSE
TRUE
FALSE
WORD
KEY
CIPHER
CODE
PLAIN
TEXT
LETTER
ALPHA
BETA
GAMMA
DELTA
SHIFT
ROUND
BLOCK
TABLE
INDEX
COUNT
MATCH
SCORE
RANK
LIST
ARRAY
VALUE
MODEL
TRAIN
TEST
DATA
INFO
INPUT
OUTPUT
SEARCH
FIND
FILTER
PART
FULL
PARTIAL
WHOLE
BEST
TOP
LOWER
UPPER
CASE
ASCII
RANDOM
ORDER
GROUP
LEVEL
POINT
LINE
GRAPH
COLOR
WHITE
BLACK
GREEN
BLUE
RED
GRAY
LIGHT
DARK
FAST
SLOW
SAFE
RISK
ATTACK
DEFEND
SECRET
PUBLIC
PRIVATE
OPENKEY
TOKEN
PASSWORD
HASH
SALT
PEPPER
WORDS
BOOK
READ
WRITE
EDIT
SAVE
LOAD
FETCH
LOCAL
REMOTE
ONLINE
OFFLINE
SITE
PAGE
HOME
ABOUT
HELP
GUIDE
DOCS
`.trim().split(/\s+/g);

// 状態
const DictState = {
  sources: [],   // { name, words:Set<string>, enabled:true }
  combined: new Set(), // 有効辞書の合成セット
};
function rebuildCombined(){
  const s = new Set();
  for(const src of DictState.sources){
    if(!src.enabled) continue;
    for(const w of src.words) s.add(w);
  }
  DictState.combined = s;
  updateDictStats();
}
function addDictSource(name, wordsArr, enabled=true){
  const up = new Set(wordsArr.map(w=>sanitizeLetters(w)));
  up.delete(""); // 空行除去
  DictState.sources.push({ name, words: up, enabled });
  rebuildCombined();
  renderDictList();
}

function updateDictStats(){
  document.getElementById("wordCount").textContent = String(DictState.combined.size);
  document.getElementById("dictStatus").textContent =
    `辞書：内蔵ミニ辞書（約200語）＋追加 ${DictState.sources.length-1} 件`;
}
function renderDictList(){
  const box = document.getElementById("dictListContainer");
  box.innerHTML = "";
  DictState.sources.forEach((src, idx)=>{
    const div = document.createElement("div");
    div.className = "dict-card";
    const cbId = `dict-en-${idx}`;
    div.innerHTML = `
      <label class="inline">
        <input type="checkbox" id="${cbId}" ${src.enabled?"checked":""}/>
        有効
      </label>
      <strong style="margin-left:.4rem">${src.name}</strong>
      <span class="muted" style="margin-left:.4rem">(${src.words.size} 語)</span>
      <button class="btn btn-ghost" style="float:right" data-action="remove">削除</button>
    `;
    div.querySelector(`#${cbId}`).addEventListener("change",(e)=>{
      src.enabled = e.target.checked;
      rebuildCombined();
    });
    div.querySelector('[data-action="remove"]').addEventListener("click", ()=>{
      if(idx===0){ alert("内蔵辞書は削除できません。"); return; }
      DictState.sources.splice(idx,1);
      rebuildCombined();
      renderDictList();
    });
    box.appendChild(div);
  });
}

// 内蔵辞書登録
addDictSource("内蔵ミニ辞書", BUILTIN_MINI, true);

// ローカル読込
document.getElementById("loadWordlistBtn").addEventListener("click", async ()=>{
  const f = document.getElementById("wordlistFile").files?.[0];
  if(!f){ alert("テキストファイルを選択してください。"); return; }
  const text = await f.text();
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  addDictSource(`local:${f.name}`, lines, true);
});
// fetch
document.getElementById("fetchWordlistBtn").addEventListener("click", async ()=>{
  const path = document.getElementById("wordlistPath").value.trim();
  if(!path){ alert("相対パスを入力してください。"); return; }
  try{
    const res = await fetch(path);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    addDictSource(`fetch:${path}`, lines, true);
  }catch(e){
    alert(`取得に失敗しました: ${e.message}`);
  }
});

// ========== 辞書による絞り込み ==========

// lastRawList: [{key, prob, conf}]
let dictCache = {
  exactHits: null,   // Map key -> {count, totalLen, words[]}
  partialHits: null, // "
};

function computeDictHits(items){
  const WORDS = DictState.combined;
  const wordsArr = Array.from(WORDS.values()); // for partial

  const exact = new Map();
  const partial = new Map();

  for(const it of items){
    const K = it.key; // 鍵そのもの
    // 完全一致
    const eHit = WORDS.has(K) ? { count: 1, totalLen: K.length, words:[K] } : { count:0, totalLen:0, words:[] };
    exact.set(K, eHit);

    // 部分一致（保持はするが表示切替）
    let pc=0, tl=0; const ws=[];
    for(const w of wordsArr){
      if(K.includes(w)){
        pc++; tl += w.length; ws.push(w);
      }
    }
    partial.set(K, {count:pc, totalLen:tl, words:ws});
  }
  dictCache.exactHits = exact;
  dictCache.partialHits = partial;
}

function rerankWithDictionary(items){
  // Score = α*(conf_norm) + β*(dictScore)
  // dictScore は (hitCount + totalLen/10) のような単純合成
  // conf は既に 0..100 → 0..1 へ正規化して使う
  const alpha = 0.6, beta = 0.4;

  const usePartial = partialCheck.checked;

  // 事前計算
  let maxDict = 0;
  const dictScoreArr = items.map(it=>{
    const K = it.key;
    const rec = usePartial ? dictCache.partialHits.get(K) : dictCache.exactHits.get(K);
    const sc = (rec.count) + (rec.totalLen/10);
    if(sc > maxDict) maxDict = sc;
    return sc;
  });

  const scored = items.map((it, idx)=>{
    const conf01 = it.conf / 100;
    const dict01 = maxDict>0 ? (dictScoreArr[idx]/maxDict) : 0;
    const S = alpha*conf01 + beta*dict01;
    return { key: it.key, baseConf: it.conf, dictScore: dictScoreArr[idx], S };
  });

  // 再ソート・信頼度%換算（相対スコアで 0..100）
  scored.sort((a,b)=>b.S - a.S);
  const maxS = scored.length ? scored[0].S : 1;
  const ranked = scored.map(r=>({
    key: r.key,
    conf: maxS>0 ? (r.S/maxS*100) : 0
  }));
  return ranked;
}

dictFilterBtn.addEventListener("click", ()=>{
  if(!lastRawList.length){
    alert("まずは『全パターン出力』を実行してください。");
    return;
  }
  // hit計算は内部的に常に両方保持
  computeDictHits(lastRawList);
  const ranked = rerankWithDictionary(lastRawList);
  const groups = groupByConfidence(ranked);
  renderGroups(groups, "辞書ヒット統合");
});

partialCheck.addEventListener("change", ()=>{
  // すでに辞書で再ランク済みなら、チェック切替で再描画
  if(dictCache.exactHits && lastRawList.length){
    const ranked = rerankWithDictionary(lastRawList);
    const groups = groupByConfidence(ranked);
    renderGroups(groups, "辞書ヒット統合");
  }
});

// ========== エクスポート ==========
function toCSV(rows){
  const head = ["rank","key","confidence%"];
  const lines = [head.join(",")];
  rows.forEach((it,idx)=>{
    lines.push([idx+1, `"${it.key}"`, it.conf.toFixed(2)].join(","));
  });
  return lines.join("\n");
}
exportCsvBtn.addEventListener("click", ()=>{
  const rows = lastRawList.length ? lastRawList : [];
  if(!rows.length){ alert("出力する結果がありません。"); return; }
  const csv = toCSV(rows);
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "alphaloom_results.csv";
  a.click();
  URL.revokeObjectURL(url);
  exportInfo.textContent = "CSV を書き出しました。";
});

exportJsonBtn.addEventListener("click", ()=>{
  const data = {
    generatedAt: new Date().toISOString(),
    results: lastRawList
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "alphaloom_results.json";
  a.click();
  URL.revokeObjectURL(url);
  exportInfo.textContent = "JSON を書き出しました。";
});

// ========== 初期表示 ==========
// 便宜: デフォで鍵長4・列を出しておく（編集しやすい）
(function bootstrap(){
  keyLengthSel.value = "4";
  onKeyLengthChange();
})();
