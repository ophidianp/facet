# Facet

A speedcubing timer with a Liquid Glass interface, WCA scrambles and WCA timing rules. Plain HTML, CSS and JavaScript, no build step.

## Features

- **WCA timing:** 15-second inspection (toggle), +2 after 15 s, DNF after 17 s, 8 and 12 second calls, truncated times, Ao5 and Mo3 per WCA 9f, no inspection for blindfolded events.
- **Scrambles for 16 events**, generated in a Web Worker:
  - Random-state: 2x2, 3x3 (Kociemba two-phase), OH, 3BLD, FMC, Pyraminx, Skewb, Clock.
  - Random-move: 5x5, 6x6, 7x7, Megaminx.
  - Not yet random-state: 4x4 and Square-1 (random moves).
- **Widgets:** three along the bottom on desktop, two at the side on landscape tablets, one at the bottom on phones and portrait tablets. Scramble preview, statistics, time trend, distribution, recent solves, consistency, personal bests, activity.
- **Customization:** theme, accent, glass opacity, frost, corner radius, timer fonts, hold time, shown stats, layout, optional lens refraction.
- **Data:** sessions per event, penalties, notes, csTimer import, JSON export. Everything is stored in your browser.

## Run it

Open `index.html` through any static server (the scramble worker needs `http://`, not `file://`):

```
python -m http.server 8000
```

Then visit http://localhost:8000. The first visit shows `login.html`; choose guest to continue.

## Layout

| File | Purpose |
| --- | --- |
| `index.html` | Timer page and styles |
| `login.html` | Sign-in page |
| `app.js` | Timer, sessions, statistics, widgets, settings |
| `scramble.js` | Scramble engine (runs as a worker) |
| `puzzles.js` | Puzzle models and scramble previews |

## Note on sign-in

Facet has no accounts of its own. On claude.ai it uses the Claude account for sync; here, only guest mode applies.
