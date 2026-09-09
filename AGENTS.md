# AGENTS.md — working guide for this repository

This file is the **source of truth** for how this website is built and the
vocabulary we use to talk about it. Any agent (or person) making changes MUST:

1. **Read this file first** and follow its conventions.
2. **Keep it updated** — whenever we introduce a new concept, rename something,
   change a convention, or add a canvas/section, update the glossary and
   conventions here in the same change.

If something in the code contradicts this file, treat it as a bug in one of
them and raise it rather than silently diverging.

---

## Glossary

The front page (`index.html`) is a **looping 1-D canvas ring**. Learn these
terms — the code and our conversations use them precisely.

| Term | Meaning |
|---|---|
| **Canvas** | One full-screen "page" in the system: Home, Photography, Work, Notes, … |
| **Detail view** | The current canvas **expanded** (`expansion` ≈ 1): big logo, its content readable/scrollable. |
| **Bird-eye view** | The current canvas **collapsed** (`expansion` ≈ 0): shrunk logo, content hidden, neighbours enlarged, watermark shown, and the **dock (nav bar) always visible** with the title docked. |
| **Ring** (`ORDER`) | The canvases sit on a 1-D **loop**: `['photos','home','work','notes']`, wrapping (Notes → Photography). Each canvas's `index` is its ring slot. |
| **`pos`** | The continuous ring position the screen is centred on; an integer centres that canvas. Panning moves `pos` the shortest way round the ring, so it loops. |
| **`ringRel(i)`** | A canvas's signed distance from `pos`, in `(-N/2, N/2]`. `0` = centred (the full open page); `±1` = the two neighbours peeking as logos at the left/right edges; `|rel| ≥ 2` = off-screen (fades as it wraps around the far side). |
| **Marker** | The element representing a canvas: the **camera** = Photography, **ZW** = Home, **"Work"/"Notes" boxes**. The centred logo is **expanded by default** (`expansion`, compact↔full); tapping it **collapses/expands** (it does NOT navigate) — collapsing also **hides that page's content and enlarges the neighbour logos** (the nav view). On scroll the centred logo shrinks and **docks into the centre of the sticky nav** (stays visible; the dots fade out). Neighbours peek and **stay fixed** — scrolling the current canvas doesn't move or fade them. Tapping the docked logo or its docked title returns the page to the top. The **camera lens cover** is open while resting on Photos in the detail view (`cameraOpen = (resting || swipeSettling) && currentId==='photos' ? expansion : 0`): it stays open when the logo docks on scroll, closes continuously while entering the bird-eye view (including a horizontal-swipe handoff), reopens along the same path if that gesture is abandoned, and stays **closed** during a committed pan. |
| **Orbit ring** (`.canvas-dots`) | The nav-centre indicator: N coloured dots (one per canvas, a `--dot-*` colour each) ride a **tilted ring** — a flat ellipse in perspective (no ring line drawn, no occluder). Dots **spin with `pos`** (`angle = (k − pos)·360°/N`), so panning turns it one notch per canvas and it loops. The current canvas's dot sits at the **front** (nearest, biggest, brightest); others recede to the back (smaller, fainter) via a depth factor. The dots fade as the logo docks in. Positions/scale/opacity/z-index set per frame in `app.js`. **Tapping it collapses the current page** (raises the dock / nav view); if scrolled it returns to the top first. |
| **Dock** (`.canvas-dock`) | A bar under the main nav. Shown as `navDock` → 1; hidden (opacity 0) when the current title sits under its logo. When shown it holds three titles: left-aligned (left canvas), centred (current), right-aligned (right canvas). Titles remain on full-width visual strips so long labels are never clipped; dock clicks are routed by their horizontal position, with the current title returning to the top and either neighbour position navigating to its canvas. |
| **`navDock`** | 0 = current title under its logo, dock hidden; 1 = title docked, dock shown. `= max(scrollDock, collapseDock)` where `collapseDock = clamp((1−expansion)/COLLAPSE_DOCK_FRAC)` and `COLLAPSE_DOCK_FRAC=1`. Raised by scrolling into content, and by **collapsing** — the title reaches the dock **exactly as the logo finishes shrinking** (in sync). In the **bird-eye view** (`expansion` 0) it's pinned at 1, so the dock is always visible. |
| **Title** (`entry`) | One per canvas, a slot on a strip that **pans** (`translateX` by `rel × dockTravel`) so titles slide in sync with the logos. The **current** title (rel≈0) sits **under its logo** (big) and animates **up into the dock** (centred, shrinking) as `navDock`→1; scrolling raises it 1:1 and it docks on arrival. The two **neighbour** titles show **only in the dock**, fading in with `navDock`. No edge captions. In the **bird-eye view** the current title is fully **docked** (navDock 1); mid-collapse it's between under-logo and dock, and `bigFs` scales with the current logo width so it shrinks with the logo. |
| **Watermark** (`.canvas-watermark`) | Four potential-content section titles separated by vertical rules, filling the empty page body while the logo is **collapsed** (shrunk). The titles and intervening rules light gradually from top to bottom, then dim in the same order. It fades continuously with the bird-eye transition (`ease(1 − expansion)`) and has a 420ms opacity transition for ordinary entry/exit. Committed click navigation disables that transition to suppress the outgoing watermark immediately, keeps it hidden through collapse/pan, then restores the transition only after the destination has painted its landed state. |
| **`currentId`** | The canvas we are resting on or heading to. During a pan, the outgoing canvas id is local to the navigation function. |
| **Dock / docking** | As you scroll an open canvas, its marker shrinks and rises up into the sticky nav bar; scrolling back up reverses it. |
| **`travelX`** | Half a viewport — the pixel distance between adjacent ring positions (so a neighbour peeks half-off the edge). |
| **`CANVASES`** | The data table in `app.js` that registers every canvas. The engine loops over it; there is no per-canvas layout code. |
| **Derivatives** | The small responsive image copies (AVIF + JPEG, two sizes) produced by `scripts/build-images.sh` from the full-size originals. |

---

## Architecture rules

- **Every canvas behaves identically.** Tapping a **neighbour's** peeking
  marker/label pans to it. Tapping the **centred** canvas's own marker
  collapses/expands its logo (if scrolled, the first tap returns it to the top).
  Tapping the **orbit ring** collapses the current page too. Back and Escape go
  Home. Don't give one canvas a bespoke interaction — behaviour belongs to the
  engine.
- **Scroll PACES collapse/expand.** Beyond tapping, scroll drives `expansion`
  directly (`applyTransitionScroll`, not a fixed tween): in the **bird-eye view**
  scrolling **down** expands into the detail view; in the **detail view at the
  top** scrolling **up** collapses into the bird-eye view. The title reaches the
  dock in sync with the logo shrinking (see `navDock`). On idle / touch-end it
  **snaps** to the nearer end (`snapExpansion`). Content only scrolls in the full
  detail view (`overflowY` auto at `expansion ≥ .999`), so the transition owns
  the wheel/touch elsewhere. Works with wheel and touch. **Detail scrolling:**
  detail content owns native scrolling at all times:
  its position is never counteracted by a buffer transform after entry. The
  logo/title start docking from the first detail scroll and travel with that
  same scroll, preserving clearance without holding or consuming reading input.
  Clicking the logo/ring enters at `scrollTop = 0`. Only the true top
  (`scrollTop ≤ 1`) permits an upward gesture to begin collapsing; returning
  through the final pixels of detail content must fully enlarge the logo/title
  first. Collapsing resets `scrollTop` to 0.
- **A locked canvas does not scroll.** When a canvas's `overflowY` is `hidden`
  (e.g. the compact/shrunk Home logo), neither native scroll nor the
  marker wheel/touch forwarding may move it.
- **Canvas scrollbars are hidden.** The interactive Home, Photography, Work,
  and Notes scroll containers retain native wheel, trackpad, touch, and keyboard
  scrolling but do not display a scrollbar. A scrollbar appearing only on
  detail entry consumes viewport width on some systems and shifts all centred
  canvas geometry. Standalone Photography pages keep normal browser scrollbars.
- **Detail-entry settle buffer.** Scroll-paced expansion caps individual
  `deltaY` steps, keeps the content anchor stable while the title docks, waits
  through a transition settle buffer, commits meaningful partial entry to
  detail on idle, and announces when the detail view is ready.
- **The engine is data-driven.** All layout, panning, docking, visibility, and
  wiring is written once against `CANVASES` in `app.js`. Adding a canvas must
  not require new geometry maths.
- **To add a canvas:** (1) add a row to `CANVASES` with a `kind`; (2) insert its
  id into `ORDER` at the ring position you want; (3) add its `<section>` of
  content in `index.html`; (4) add its marker + title-entry elements; (5) append
  its selectors to the shared `.work-*` rules in `styles.css`; (6) add a link in
  `nav.js`'s page map. No layout maths change.
- **Keep pans smooth.** Navigation goes: scroll the current canvas to the top →
  use the shared handoff to shrink/fade it while beginning the sideways motion
  → pan → the destination **arrives collapsed and stays** in the nav view
  (`finish()` does not auto-expand; tap
  the logo/ring or scroll down to enter). Mid-pan the dock titles pan across
  with the markers, then settle under the new logo. Sections slide via `transform:
  translate3d` (compositor-only) and content is hidden during pans, so the pan
  stays light. Never animate section `left`/`width`.
- **Cursor pass-through.** Markers AND titles forward wheel/touch to the active
  canvas (`forwardScroll`), so hovering either still scrolls the page.
- **Scroll transform stability.** Detail content keeps one stable compositor
  transform; native scroll events only schedule the shared renderer. Do not
  alternate transform functions or write a redundant transform in the scroll
  handler: frequent mobile scroll events make text visibly stutter.
- **Touch direction locking.** A shared viewport touch gesture uses an intentionally asymmetric axis lock: slightly dominant vertical movement locks quickly after `TOUCH_VERTICAL_INTENT`, while horizontal navigation requires the longer `TOUCH_HORIZONTAL_INTENT` and clear dominance set by `TOUCH_HORIZONTAL_AXIS_RATIO`. This keeps diagonal scrolling vertical unless the user makes an unmistakable left/right swipe. A deliberate horizontal swipe drives the continuous ring preview and may cross multiple `ORDER` slots. Touch uses its own, slightly longer `TOUCH_SWIPE_DRAG_FRACTION` so small diagonal corrections do not pull toward a neighbouring canvas; desktop sensitivity remains independent. Horizontal gestures are ignored while a return-to-top, expansion, or pan is active; uncertain gestures do not navigate. Locked horizontal gestures complete on `touchend` or `touchcancel`.
- **Mobile vertical collapse.** A downward finger pull at the true top of a
  fully expanded canvas is owned by the transition engine and collapses the
  detail view continuously into the bird-eye view. This takes priority over
  native pull-to-refresh inside the canvas viewport. The centred marker and
  orbit ring remain alternative collapse controls, and desktop upward wheel
  input retains the same scroll-paced collapse.
- **Desktop/mobile parity.** Desktop horizontal wheel/trackpad input and mobile horizontal touch input use the same continuous ring preview, handoff, dock, and settle behavior. The detail-to-dock handoff runs on animation frames (never only on input events), so it stays smooth even when touch events are sparse. A gesture begins from the current rendered logo/title positions and must finish that handoff before ring panning starts. Detail text has its own opacity track as well as the canvas fade, following continuous `expansion` on entry and exit rather than appearing in a final frame. Its `visibility` may switch only at a near-zero opacity threshold, never at the expanded endpoint. Incomplete gestures reverse the same visual path: the marker/title return from the dock, the saved reading position restores, and detail content fades back in proportion to the returning expansion; it remains unavailable to interaction until fully restored. Vertical content scrolling preserves the current reading position; it does not reset to the top merely because a touch gesture begins.
- **Desktop horizontal navigation.** Horizontal trackpad/wheel input (`deltaX`, or Shift+wheel) drives the same live swipe preview as touch and settles after wheel input pauses. Ordinary vertical wheel input keeps scrolling and Ctrl+wheel remains available for browser zoom.
- **Continuous desktop navigation.** Horizontal wheel input drives one continuous ring preview across as many ring slots as the gesture covers. When wheel input pauses, the nearest canvas slot is selected and the page settles there; input is not queued for later pans.
- **Swipe handoff and reading position.** A horizontal swipe progressively fades and collapses the outgoing detail view during the drag, then advances the ring toward its destination in the latter part of the same gesture. Release/idle keeps the 30/70 behavior: a gesture reaching 70% commits, while a short/cancelled gesture rolls back. Continuous travel may span any number of complete loops; all destination offsets use positive modulo normalization so large negative offsets never resolve to an invalid slot and roll back. The engine remembers a canvas's scroll position when leaving by swipe and restores it only when that canvas is expanded again; a fresh canvas enters at the true top (`scrollTop = 0`).
- **Dock-before-pan frame.** A horizontal handoff must render one completed dock frame before the ring begins moving. This prevents a moving canvas from overlapping a logo or title that has not visually finished docking.
- **Queued handoff travel.** Horizontal distance received while the logo/title
  are docking is preserved, then replayed smoothly after the completed dock
  frame. Touch-end or desktop idle settlement waits for that replay. Never reset
  the pan origin to the accumulated distance: doing so discards valid gesture
  intent and incorrectly rolls the canvas back.
- **Collapsed content is unavailable.** A canvas content region is `inert` and `aria-hidden="true"` unless its canvas is current, settled, and fully expanded. This keeps hidden cards and links out of keyboard focus and assistive-technology navigation during bird-eye view and pans.
- **It's a loop.** Panning always takes the shortest way around the ring, so
  Notes → Photography wraps. Each canvas is placed by `ringRel` (its signed
  distance from `pos`): centre = the full open page, `±1` neighbours peek as
  logos, far side hidden. Content is hidden during a pan and only the centred
  canvas's content becomes available in the settled detail view.

## Code conventions

- **Site identity:** The portfolio is branded **wizark's Portfolio**; Photography remains a section within it.
- **No commits or pushes** unless the user explicitly asks.
- **Cache-busting:** every HTML file loads CSS/JS with `?v=N`. When you edit
  `styles.css`, `app.js`, or `nav.js`, bump `N` in **all** HTML files that load
  it (root `index.html` + everything in `photography/`).
- **Colours:** use the palette CSS variables in `:root` (`--ink`, `--paper`,
  `--muted`, `--line`, `--accent`, `--logo-line`, `--wash-*`). Do not hard-code
  new hex values; add a variable if you need a new colour.
- **Fonts:** use the font CSS variables (`--font-serif`, `--font-sans`). Do not
  introduce new `font-family` literals. See "Typography" below.
- **CSS structure:** `styles.css` is grouped by `/* ===== Section ===== */`
  headers. Some selectors are declared in layered "refinements"; those are
  commented — keep the ordering, don't merge across media queries.
- **JavaScript style:** one statement per line; name magic numbers as constants
  at the top of the IIFE; keep related interaction state in a named object;
  keep the hot path (`placeView`) allocation-light. Shared render helpers own
  content availability (`opacity`, `visibility`, scrolling, pointer events,
  `inert`, and `aria-hidden`), and repeated style/attribute writes are cached.
  Touch and desktop gestures may normalize input differently, but both feed the
  same swipe-travel renderer and settle logic.

## Typography

- **Family:** self-hosted **Montebello** (WOFF files in `assets/fonts/`, declared
  via `@font-face` at the top of `styles.css`). Two faces are kept:
  **Montebello Sans** (`--font-sans`, the whole site; `--font-serif` points at it)
  and **Montebello Rounded** (`--font-rounded`, a display face used only for the
  Home placeholder section headings, `.home-section h2`). Use the variables —
  never a raw `font-family` literal.
- The zip also shipped Montebello **Script** and **Script-Textured**; those were
  removed (unused). To reintroduce a display face for headings site-wide, add its
  `@font-face` and repoint `--font-serif`.
- Fonts are WOFF only (no WOFF2 supplied) and load with `font-display:swap`.
  Montebello Sans is a display face — if body text / small captions read poorly,
  that's the signal to pick a text face for `--font-sans`.

## Accessibility & resilience

- Markers are real `<button>`s with `aria-label`s that update on state change.
- `prefers-reduced-motion` is honoured (animations become instant snaps).
- A `<noscript>` fallback links to the Photography section for JS-off visitors.
- Keep `inert` on inactive canvases so assistive tech only sees the active one.

## Assets & image pipeline

- Originals live in `assets/<section>/originals/` **locally only** — they are
  **gitignored** (not committed/served). Keep them on your machine as the source
  for `./scripts/build-images.sh`, which regenerates the derivatives that ship.
- Photography stills → `assets/photography/`; camera/home art → `assets/camera/`.
- `<img>` uses `<picture>` with an AVIF `<source>` + JPEG fallback, `srcset`
  (two widths) + `sizes`, and `decoding="async"`.

## Folder map

```
index.html            front page (the canvas engine)
styles.css  app.js  nav.js
photography/           the photography site (index + photo-01..03)
assets/camera/ assets/photography/   (+ originals/ subfolders)
scripts/build-images.sh
```
