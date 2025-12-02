# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AlphaLoom** is a web-based cryptographic key candidate analysis tool designed primarily for Vigenère cipher key identification. It generates all possible string patterns from column-wise character candidates with weights, ranks them by confidence, and performs dictionary matching for enhanced scoring.

Part of the "100 Security Tools with AI" project (Day 046) - cryptanalysis assistance for educational/CTF purposes.

This is a pure client-side web application built with vanilla HTML, CSS, and JavaScript - no build process or dependencies required.

## Development Commands

```bash
# Serve locally (any method works)
python -m http.server 8000
# OR
npx http-server
# OR open index.html directly in browser
```

**No build, test, or lint commands** - runs directly in browser.

## Architecture

**Files**: `index.html` (UI), `script.js` (~870 lines, all logic), `style.css` (light theme), `wordlists/` (dictionary files)

### Key Algorithms (script.js)

**Beam Search Pattern Generation** (`generateCandidates`, ~line 119):
- Uses beam search with configurable width (default 2000) and expansion limit (default 50000)
- Combines character probabilities across columns using log probabilities
- Returns ranked candidates with confidence scores

**Confidence Scoring** (`normalizeConfidence`, `groupByConfidence`):
- Normalizes log probabilities to percentage confidence
- Groups results into high (top 20%), medium (next 30%), and low (remaining) confidence tiers

**Dictionary Integration** (`computeDictHits`, `rerankWithDictionary`):
- Supports both exact and partial dictionary matching
- Combines column-based confidence (60%) with dictionary hit scores (40%)
- Multiple dictionary sources with enable/disable functionality

### Data Structures

**Column Format**: `[{ch: "A", p: 0.5}, {ch: "B", p: 0.3}, ...]`
- Characters with linear probability weights (first character gets highest weight)
- Empty columns default to uniform A-Z distribution

**Dictionary State** (`DictState`):
- `sources[]`: Array of dictionary objects with name, word set, and enabled flag
- `combined`: Merged Set of all enabled dictionary words
- Built-in mini dictionary (~200 common English words)

### Key Functions

- `generateCandidates(cols, beamWidth, maxExpand)`: Core beam search implementation
- `getColumns()`: Extracts user input into probability arrays
- `linearProbabilities(chars)`: Assigns descending weights to character list
- `computeDictHits(items)`: Dictionary matching for exact/partial hits
- `rerankWithDictionary(items)`: Combines confidence and dictionary scores
- `addDictSource(name, wordsArr, enabled)`: Manages multiple dictionary loading

## Algorithm Documentation

See **[ALGORITHM.md](ALGORITHM.md)** for detailed technical documentation covering beam search, scoring methods, and optimization techniques.