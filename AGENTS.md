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
| **Marker** | The element representing a canvas: the **camera** = Photography, **ZW** = Home, **"Work"/"Notes" boxes**. The centred logo is **expanded by default** (`expansion`, compact↔full); tapping it **collapses/expands** (it does NOT navigate) — collapsing also **hides that page's content and enlarges the neighbour logos** (the nav view). On scroll the centred logo shrinks and **docks into the centre of the sticky nav** (stays visible; the dots fade out). Neighbours peek and **stay fixed** — scrolling the current canvas doesn't move or fade them. Tapping the docked logo or its docked title returns the page to the top. The **camera lens cover** is open **only while resting on Photos in the detail view** (`cameraOpen = resting && currentId==='photos' ? expansion : 0`): it stays open when the logo docks on scroll, and stays **closed** in the bird-eye view and during every pan (so it never flashes open mid-pan). |
| **Orbit ring** (`.canvas-dots`) | The nav-centre indicator: N coloured dots (one per canvas, a `--dot-*` colour each) ride a **tilted ring** — a flat ellipse in perspective (no ring line drawn, no occluder). Dots **spin with `pos`** (`angle = (k − pos)·360°/N`), so panning turns it one notch per canvas and it loops. The current canvas's dot sits at the **front** (nearest, biggest, brightest); others recede to the back (smaller, fainter) via a depth factor. The dots fade as the logo docks in. Positions/scale/opacity/z-index set per frame in `app.js`. **Tapping it collapses the current page** (raises the dock / nav view); if scrolled it returns to the top first. |
| **Dock** (`.canvas-dock`) | A bar under the main nav. Shown as `navDock` → 1; hidden (opacity 0) when the current title sits under its logo. When shown it holds three titles: left-aligned (left canvas), centred (current), right-aligned (right canvas). |
| **`navDock`** | 0 = current title under its logo, dock hidden; 1 = title docked, dock shown. `= max(scrollDock, collapseDock)` where `collapseDock = clamp((1−expansion)/COLLAPSE_DOCK_FRAC)` and `COLLAPSE_DOCK_FRAC=1`. Raised by scrolling into content, and by **collapsing** — the title reaches the dock **exactly as the logo finishes shrinking** (in sync). In the **bird-eye view** (`expansion` 0) it's pinned at 1, so the dock is always visible. |
| **Title** (`entry`) | One per canvas, a slot on a strip that **pans** (`translateX` by `rel × dockTravel`) so titles slide in sync with the logos. The **current** title (rel≈0) sits **under its logo** (big) and animates **up into the dock** (centred, shrinking) as `navDock`→1; scrolling raises it 1:1 and it docks on arrival. The two **neighbour** titles show **only in the dock**, fading in with `navDock`. No edge captions. In the **bird-eye view** the current title is fully **docked** (navDock 1); mid-collapse it's between under-logo and dock, and `bigFs` scales with the current logo width so it shrinks with the logo. |
| **Watermark** (`.canvas-watermark`) | Four potential-content section titles separated by vertical rules, filling the empty page body while the logo is **collapsed** (shrunk). The titles and intervening rules light gradually from top to bottom, then dim in the same order. Opacity = `1 − expansion` at rest; hidden when expanded or panning. |
| **Home cue** | On the compact (mobile) Home logo, the looping hint that lists the four Home sub-sections (About me / Selected notes / Things happening / More) with a "light" travelling top-to-bottom. The four numbers must stay `01`–`04` and match the cue. |
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
  the wheel/touch elsewhere. Works with wheel and touch. **Buffer:** the first
  `SCROLL_BUFFER` px of content scroll are a hold — the logo + title stay full
  and **the content stays put** (the active `content` is offset down by
  `min(scroll, SCROLL_BUFFER)` to cancel the scroll; matching bottom padding
  keeps the end reachable) — so entering the detail view registers before
  anything moves. **Clicking** the logo/ring to enter lands at the END of the
  buffer (`enterDetail` sets `scrollTop = SCROLL_BUFFER`), skipping the hold;
  scroll entry keeps it. Scroll positions `≤ SCROLL_BUFFER` count as "top" for
  collapsing, and collapsing resets `scrollTop` to 0.
- **A locked canvas does not scroll.** When a canvas's `overflowY` is `hidden`
  (e.g. the compact/shrunk Home logo), neither native scroll nor the
  marker wheel/touch forwarding may move it.
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
  **collapse it** (shrink logo, hide content) → pan → the destination **arrives
  collapsed and stays** in the nav view (`finish()` does not auto-expand; tap
  the logo/ring or scroll down to enter). Mid-pan the dock titles pan across
  with the markers, then settle under the new logo. Sections slide via `transform:
  translate3d` (compositor-only) and content is hidden during pans, so the pan
  stays light. Never animate section `left`/`width`.
- **Cursor pass-through.** Markers AND titles forward wheel/touch to the active
  canvas (`forwardScroll`), so hovering either still scrolls the page.
- **Touch direction locking.** A shared viewport touch gesture chooses an axis after `TOUCH_INTENT` px: predominantly vertical movement keeps the scroll-paced transition, while a deliberate left/right swipe navigates one adjacent `ORDER` slot through `navigateFromSwipe`. Horizontal gestures are ignored while a return-to-top, expansion, or pan is active; uncertain gestures do not navigate. Locked horizontal gestures complete on `touchend` or `touchcancel`.
- **Desktop horizontal navigation.** Horizontal trackpad/wheel input (`deltaX`, or Shift+wheel) drives the same live swipe preview as touch and settles after wheel input pauses. Ordinary vertical wheel input keeps scrolling and Ctrl+wheel remains available for browser zoom.
- **Continuous desktop navigation.** Horizontal wheel input drives one continuous ring preview across as many ring slots as the gesture covers. When wheel input pauses, the nearest canvas slot is selected and the page settles there; input is not queued for later pans.
- **Swipe handoff and reading position.** A horizontal swipe progressively fades and collapses the outgoing detail view during the drag, then advances the ring toward its destination in the latter part of the same gesture. Release commits a sufficiently complete drag; a short or cancelled drag rolls back. The engine remembers a canvas's scroll position when leaving by swipe and restores it only when that canvas is expanded again; a fresh canvas still enters at `SCROLL_BUFFER`.
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
  at the top of the IIFE; keep the hot path (`placeView`) allocation-light.

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
