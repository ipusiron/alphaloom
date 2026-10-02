# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AlphaLoom** - 列ごとの候補文字から鍵を探すツール. A static web app: the user lists likely letters for each position (column) of a key in order of preference; the tool lists the combinations with the largest weights exactly and scores dictionary words against the columns. Main use: narrowing down a Vigenère key that is an English word once the key length and per-column clues are known. Input and dictionaries never leave the browser.

Part of the "100 Security Tools with Generative AI" project (Day046).

## Architecture

- **index.html**: UI with three ARIA tabs (generator, dictionaries, usage). Meta CSP without `'unsafe-inline'`; hidden sections use the `hidden` attribute (no style attributes)
- **script.js**: UI entry (ES module). Builds column inputs, tables and the dictionary list with `textContent` only; no `alert`/`confirm`
- **js/loom-core.js**: Pure logic (no DOM): `normalizeLetters`, `columnLetters`, `parsePattern`, `columnModel`/`buildColumns`, `countCombinations` (BigInt), `topCombinations`, `scoreDictionary`, `findWordsInKey`, `parseWordList`, `formatShare`, `toCsv`
- **js/wordlists.js**: Built-in mini dictionary (222 words, same words as `wordlists/english-mini-223.txt`) and the bundled wordlist table
- **js/messages.js**: All UI strings (Japanese; English is planned). Logic returns keys and values only
- **js/tabs.js / theme.js / theme-init.js / file-check.js**: Tabs with arrow keys, light/dark theme, notice when opened via `file://`
- **style.css**: Color tokens on `:root`, dark overrides for `data-theme="dark"` and `prefers-color-scheme`

### Algorithms

1. **Column weights**: N letters get linear weights N..1 normalized to sum 1; a blank column is uniform over A-Z. A key's weight is the product of its column weights (all combinations sum to 100%). It is not the probability that the key is correct
2. **Top combinations**: best-first search over index tuples with a priority queue (each pop pushes the tuples advanced by one position in each column; visited set). Exact top-K regardless of the total (26^20 works); keys always have the chosen length. Ties are ordered alphabetically
3. **Dictionary scoring**: every dictionary word of the same length is scored by the product of its letters' column weights; words with a letter outside a column's candidates are dropped. Not limited to the kept top-K
4. **Partial matches**: dictionary words of 3+ letters contained in a candidate, found by looking up the candidate's substrings in a Set

See `ALGORITHM.md` for details (Japanese).

## Development Commands

- `npm test` — node:test, no dependencies, Node 22+. Runs in GitHub Actions on push and pull requests
- Serve over HTTP to run the UI: `python -m http.server 8000` → `http://localhost:8000/`. Chrome/Edge cannot load ES modules from `file://`; Firefox can, but bundled wordlists cannot be fetched there

## Testing

- `test/core.test.js`: normalization, patterns, weights, top combinations (compared with brute force on 300 random inputs), dictionary scoring, partial matches, CSV
- `test/wordlists.test.js`: bundled wordlist counts, built-in list equals `english-mini-223.txt`
- `test/readme.test.js`: README YAML structure, section order, tables and numbers, directory tree, images; ALGORITHM.md numbers
- `test/html.test.js`, `test/contrast.test.js`, `test/messages.test.js`, `test/format.test.js`: CSP and markup, color contrast and control sizes, strings kept in messages.js, minified-file detection

## Key Implementation Notes

- Never use `innerHTML` for user-provided data. Tests forbid `innerHTML`, `.style.` and `alert`/`confirm` in the UI scripts
- Column inputs are normalized only when not composing (IME-safe: `input` with `isComposing` check plus `compositionend`)
- Bundled wordlists are fetched only from the fixed list in `js/wordlists.js` (no free-form paths)
- Keep the README YAML metadata structure (keys, order, block lists) unchanged; `readme.test.js` checks it
