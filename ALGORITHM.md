# AlphaLoom アルゴリズム解説

このドキュメントでは、AlphaLoomで使用されているアルゴリズムとロジックについて詳しく解説します。

## 📊 概要

AlphaLoomは以下の3つの主要なアルゴリズムを組み合わせて動作します：

1. **ビームサーチによる候補生成**
2. **線形重み付けによる信頼度計算**
3. **辞書統合スコアリング**

---

## 🔍 1. ビームサーチによる候補生成

### アルゴリズム概要

```
for 各位置 pos = 0 to L-1:
    next = []
    for 各現在の候補 state in beam:
        for 各文字候補 char in columns[pos]:
            next.add({
                key: state.key + char,
                logp: state.logp + log(char.probability)
            })
    beam = top_k(next, beamWidth)  // 上位beamWidth個を保持
```

### 実装詳細

**初期化:**
```javascript
let beam = [{ key: "", logp: 0 }];  // 空文字から開始
let expandedTotal = 0;
```

**各位置での展開:**
```javascript
for(let pos = 0; pos < cols.length; pos++) {
    const next = [];
    const candidates = cols[pos];  // この位置の文字候補
    
    for(const state of beam) {
        for(const char of candidates) {
            next.push({
                key: state.key + char.ch,
                logp: state.logp + Math.log(char.p)
            });
            expandedTotal++;
        }
    }
    
    // 上位beamWidth個のみ保持
    next.sort((a,b) => b.logp - a.logp);
    beam = next.slice(0, beamWidth);
}
```

### パラメーターの影響

| パラメーター | 効果 | 推奨値 |
|-----------|------|--------|
| **beamWidth** | 多様性と精度 | L文字なら26^(L-2)以上 |
| **maxExpand** | 処理速度と完全性 | L文字なら26^L/10以上 |

**例：5文字の場合**
- beamWidth: 17,576以上（26³）
- maxExpand: 1,188,138以上（26⁵/10）

---

## ⚖️ 2. 線形重み付けによる信頼度計算

### 重み付けロジック

各列で入力された文字の順序に基づいて重みを計算：

```
文字候補: "CAB"
重み: C=3, A=2, B=1
正規化後確率: C=3/6=0.5, A=2/6=0.33, B=1/6=0.17
```

### 実装コード

```javascript
function linearProbabilities(chars) {
    const N = chars.length;
    const denominator = N * (N + 1) / 2;  // 1+2+...+N
    
    return chars.map((ch, i) => ({
        ch: ch,
        p: (N - i) / denominator  // 先頭ほど高い確率
    }));
}
```

### 信頼度の正規化

```javascript
function normalizeConfidence(list) {
    const probs = list.map(item => Math.exp(item.logp));
    const total = probs.reduce((sum, p) => sum + p, 0);
    
    return list.map((item, idx) => ({
        key: item.key,
        conf: total > 0 ? (probs[idx] / total * 100) : 0
    }));
}
```

---

## 📚 3. 辞書統合スコアリング

### スコア統合式

```
統合スコア = α × 列重み信頼度 + β × 辞書ヒットスコア
```

**デフォルト値:**
- α = 0.6（列重みの寄与）
- β = 0.4（辞書ヒットの寄与）

### 辞書ヒットスコア計算

**完全一致の場合:**
```javascript
exactScore = hitCount + (totalLength / 10)
// 例: "ABOUT"が辞書にある → score = 1 + (5/10) = 1.5
```

**部分一致の場合:**
```javascript
partialScore = hitCount + (totalLength / 10)
// 例: "THEKEY"で"THE"と"KEY"がヒット → score = 2 + (6/10) = 2.6
```

### フィルタリング処理

```javascript
function rerankWithDictionary(items) {
    // 1. 辞書ヒットしたアイテムのみフィルタリング
    const filteredItems = items.filter(item => {
        const hits = usePartial ? partialHits.get(item.key) : exactHits.get(item.key);
        return hits && hits.count > 0;
    });
    
    // 2. 統合スコア計算
    const scored = filteredItems.map(item => {
        const conf01 = item.conf / 100;
        const dict01 = dictScore / maxDictScore;
        return {
            key: item.key,
            score: α * conf01 + β * dict01
        };
    });
    
    // 3. 再ソートと信頼度換算
    scored.sort((a, b) => b.score - a.score);
    return scored.map(item => ({
        key: item.key,
        conf: (item.score / maxScore) * 100
    }));
}
```

---

## 🎯 4. 信頼度グループ分類

結果は信頼度に基づいて3つのグループに自動分類されます：

```javascript
function groupByConfidence(items) {
    const n = items.length;
    const highEnd = Math.ceil(n * 0.2);    // 上位20%
    const midEnd = Math.ceil(n * 0.5);     // 次の30%
    
    return {
        high: items.slice(0, highEnd),       // 高信頼
        mid:  items.slice(highEnd, midEnd),  // 中信頼  
        low:  items.slice(midEnd)            // 低信頼
    };
}
```

---

## 🔧 5. パフォーマンス最適化

### メモリ使用量削減

- **ビームサーチ**: 各段階で上位候補のみ保持
- **早期終了**: maxExpand到達時の処理停止
- **オブジェクトプール**: 不要になったオブジェクトの即座解放

### 計算量分析

| 処理 | 計算量 | 実際の値（5文字、beam=50k） |
|------|--------|---------------------------|
| 候補生成 | O(L × beamWidth × 26) | O(5 × 50,000 × 26) |
| ソート | O(candidates × log(candidates)) | O(1,300,000 × log(1,300,000)) |
| 辞書照合 | O(candidates × dictSize) | O(50,000 × 222) |

### 実行時間目安

| 文字数 | ビーム幅 | 最大展開 | 予想時間 |
|--------|----------|----------|----------|
| 3文字 | 676 | 17,576 | <100ms |
| 4文字 | 17,576 | 456,976 | 200-500ms |
| 5文字 | 50,000 | 1,188,138 | 500ms-2s |
| 6文字 | 676,000 | 30,891,594 | 5-15s |

---

## 🎓 6. アルゴリズムの理論的背景

### ビームサーチの特徴

**利点:**
- メモリ効率が良い（全探索の回避）
- 近似最適解を効率的に発見
- パラメーター調整で精度と速度のバランス制御

**制限:**
- 真の最適解を見逃す可能性
- ビーム幅が小さいと多様性が失われる
- 局所最適解に陥るリスク

### 重み付け手法の根拠

**線形重み付けの選択理由:**
1. **直感的**: 入力順序が重要度を表現
2. **計算効率**: O(n)の線形計算
3. **調整可能**: ユーザーが重み順序を制御

**代替手法との比較:**
- 指数重み付け: 差が極端になりすぎる
- 均等重み付け: ユーザー入力の意味が失われる
- ログ重み付け: 実装が複雑で効果が限定的

---

## 📈 7. 実用的な使用例

### Vigenère暗号解読での応用

```
暗号文: LXFOPVEFRNHR
推定鍵長: 5文字
頻度解析結果:
  位置1: T,H,A (高頻度)
  位置2: H,E,A (中頻度)
  位置3: E,A,I (低頻度)
  位置4: (空欄 = 全文字等確率)
  位置5: Y,S,T (推測)

AlphaLoom入力:
  列1: "THA"
  列2: "HEA"  
  列3: "EAI"
  列4: (空欄)
  列5: "YST"

期待される上位候補:
  THEAY, THEZY, THAAY, HEAAY, ...
```

### 設定値の決定指針

**保守的設定（確実性重視）:**
```
ビーム幅: 26^(L-1)
最大展開: 26^L
実行時間: 長い
精度: 最高
```

**バランス設定（推奨）:**
```
ビーム幅: 26^(L-2)
最大展開: 26^L / 10
実行時間: 中程度
精度: 高い
```

**高速設定（速度重視）:**
```
ビーム幅: 1000-5000
最大展開: 100,000
実行時間: 短い
精度: 中程度
```

---

## 🔬 8. 将来の拡張可能性

### アルゴリズム改良案

1. **適応的ビーム幅**: 各位置で動的に調整
2. **多目的最適化**: 複数の評価指標を同時最適化
3. **機械学習統合**: 過去の成功パターンから学習
4. **並列処理**: Web Workers活用による高速化

### 新機能への応用

1. **他の暗号形式**: Caesar、Playfair、Hill暗号への拡張
2. **言語モデル統合**: N-gramモデルによる文脈考慮
3. **視覚化**: アルゴリズム実行過程のリアルタイム表示
4. **バッチ処理**: 複数暗号文の一括処理

---

この解説が AlphaLoom のアルゴリズムの理解と効果的な活用に役立てば幸いです。