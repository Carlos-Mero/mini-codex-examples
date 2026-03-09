# Dou Dizhu Deluxe

A polished standalone browser implementation of **Dou Dizhu (斗地主)** built with plain HTML, CSS, and JavaScript.

## Features

- Single-player play against two AI opponents
- Full deal, bidding, landlord assignment, and bottom-card reveal
- Support for core Dou Dizhu combinations:
  - single / pair / triple
  - triple + single / triple + pair
  - straights
  - consecutive pairs
  - airplanes
  - airplanes with single or pair wings
  - four with two singles / four with two pairs
  - bombs and rocket
- Visual tabletop UI with styled cards, score panels, logs, and result overlay
- Hint button and keyboard shortcuts
- Persistent browser win / score stats

## Run

Open `index.html` directly in a modern browser.

## Controls

- Click cards to select
- **Play Selected**: play the chosen valid combination
- **Pass**: pass when responding to an active trick
- **Hint**: select a suggested move
- **Clear**: clear card selection
- **Sort**: toggle grouped/rank sorting
- Keyboard:
  - `H`: hint
  - `Esc`: clear selection
  - `Space`: play selection, or pass if no valid selection

## Notes

This is a front-end standalone implementation focused on being fully playable and visually polished without requiring a build step or external dependencies.
