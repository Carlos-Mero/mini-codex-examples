# Dou Dizhu Royale

A polished, dependency-free, single-player browser version of Dou Dizhu built as a standalone front-end project.

## Features

- Full 54-card deck with landlord bidding and 3-card kitty
- Human player versus two AI opponents
- Play validation for the core Dou Dizhu pattern set:
  - single, pair, triple
  - triple with single / pair
  - straight, pair straight
  - plane, plane with singles, plane with pairs
  - four with two singles / two pairs
  - bomb and rocket
- Multiplier growth on bombs and rocket
- Hint system, round history, session stats, and local coin tracking
- Responsive casino-table presentation with no build step required

## Run

Open [index.html](./index.html) directly in a browser.

If you prefer a local server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.
