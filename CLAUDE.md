# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AlphaLoom** is a web-based cryptographic key candidate analysis tool designed primarily for Vigenère cipher key identification. It generates all possible string patterns from column-wise character candidates with weights, ranks them by confidence, and performs dictionary matching for enhanced scoring.

This is a pure client-side web application built with vanilla HTML, CSS, and JavaScript - no build process or dependencies required.

## Development Commands

This is a static web application. To run locally:

```bash
# Serve the application (any local server will work)
python -m http.server 8000
# OR
npx http-server
# OR simply open index.html in a browser
```

**No build, test, or lint commands** - the application runs directly in the browser.

## Architecture

### Core Components

- **index.html**: Main UI with tabbed interface (Generator, Dictionary, About)
- **script.js**: Complete application logic (~670 lines)
- **style.css**: Dark theme styling with CSS variables
- **wordlists/**: Dictionary files for key validation

### Key Algorithms (script.js)

**Beam Search Pattern Generation** (`generateCandidates`, lines 115-144):
- Uses beam search with configurable width (default 2000) and expansion limit (default 50000)
- Combines character probabilities across columns using log probabilities
- Returns ranked candidates with confidence scores

**Confidence Scoring** (`normalizeConfidence`, `groupByConfidence`):
- Normalizes log probabilities to percentage confidence
- Groups results into high (top 20%), medium (next 30%), and low (remaining) confidence tiers

**Dictionary Integration** (`computeDictHits`, `rerankWithDictionary`):
- Supports both exact and partial dictionary matching
- Combines column-based confidence (60%) with dictionary hit scores (40%)
- Allows multiple dictionary sources with enable/disable functionality

### Data Structures

**Column Format**: `[{ch: "A", p: 0.5}, {ch: "B", p: 0.3}, ...]`
- Characters with linear probability weights (first character gets highest weight)
- Empty columns default to uniform A-Z distribution

**Dictionary State** (`DictState`):
- `sources[]`: Array of dictionary objects with name, word set, and enabled flag
- `combined`: Merged Set of all enabled dictionary words
- Built-in mini dictionary (~200 common English words)

### UI Patterns

**Tab System**: Simple show/hide with `.active` class toggle
**Dynamic Forms**: Key length selector generates input columns dynamically
**Real-time Validation**: Input sanitization to A-Z characters only with deduplication

## File Structure

```
/
├── index.html          # Main application UI
├── script.js           # Complete application logic
├── style.css           # Dark theme styling
├── wordlists/          # Dictionary files
│   ├── animals.txt
│   ├── english-mini-223.txt
│   ├── english_1842.txt
│   └── english_5067.txt
├── README.md           # Project documentation (Japanese)
└── LICENSE             # MIT license
```

## Key Functions

- `generateCandidates()`: Core beam search implementation
- `getColumns()`: Extracts user input into probability arrays  
- `computeDictHits()`: Dictionary matching for exact/partial hits
- `rerankWithDictionary()`: Combines confidence and dictionary scores
- `addDictSource()`: Manages multiple dictionary loading

## Algorithm Documentation

Detailed algorithm explanations are available in:
- **[ALGORITHM.md](ALGORITHM.md)**: Comprehensive technical documentation covering beam search, scoring methods, and optimization techniques

## Usage Context

This tool is part of the "100 Security Tools with AI" project (Day 046), focused on cryptanalysis assistance for educational/research purposes. The beam search algorithm efficiently handles the combinatorial explosion of key candidates while dictionary integration helps identify meaningful patterns.