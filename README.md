# wwizark.github.io — Zekai Wei's website

This is a small personal website. It has two parts:

1. **The front page** — a picture of a little camera. When you tap it, the
   camera "opens" and slides you over to the Photography or Work area. It feels
   like one moving page instead of clicking to a new one.
2. **The Photography section** — normal, calm web pages that show the photos
   bigger, one project at a time.

There is **no framework and no build tool** to install. It's just plain HTML,
CSS, and JavaScript files. You can open them in a browser and they work.

---

## The files, explained like you're five

Think of the website like a puppet show:

| File | What it is | The puppet-show version |
| --- | --- | --- |
| `index.html` | The front page | The **stage** — where the camera puppet stands |
| `styles.css` | All the colors, sizes, and spacing | The **paint and costumes** — how everything looks |
| `app.js` | The camera animation and sliding | The **puppeteer** — makes the camera move when you tap |
| `nav.js` | The little "Menu" and "Contact" pop-ups | A **small helper** that opens two pop-up notes |
| `photography/` | The calmer photo pages | A **second, quieter room** you can walk into |
| `assets/` | All the pictures | The **box of props** (the camera picture, the photos) |
| `scripts/build-images.sh` | Shrinks big photos into small ones | A **magic shrink-ray** for pictures (run once) |

---

## Where things live (the folder map)

```
.
├── index.html              ← front page (the camera)
├── styles.css              ← ALL the styling for every page
├── app.js                  ← the camera + sliding animation
├── nav.js                  ← the Menu / Contact pop-ups (used by every page)
│
├── photography/            ← the photography website
│   ├── index.html          ← the gallery (list of 3 projects)
│   ├── photo-01.html       ← "Thresholds"
│   ├── photo-02.html       ← "Staged Encounters"
│   └── photo-03.html       ← "Reflected City"
│
├── assets/
│   ├── camera/             ← pictures for the front page's camera
│   │   ├── camera-front-480.avif / .jpeg   (small)
│   │   ├── camera-front-960.avif / .jpeg   (big)
│   │   ├── lens-cover-upper.png            (drawn onto the lens)
│   │   ├── lens-cover-lower.png            (drawn onto the lens)
│   │   └── originals/      ← the full-size source (not shown to visitors)
│   │
│   └── photography/        ← the 3 photos, in small + big sizes
│       ├── M000099-800.avif / .jpeg  … -1600.avif / .jpeg
│       ├── M000575-…
│       ├── M000703-…
│       └── originals/      ← the huge 6192px source files
│
└── scripts/
    └── build-images.sh     ← makes the small picture copies
```

**Two simple rules for the folders:**
- A photo used by the photography site lives in `assets/photography/`.
- A picture used by the front-page camera lives in `assets/camera/`.

---

## How the pictures work (and why it's fast)

The camera and the photos were **enormous** originals (6192×4128, ~800 KB each).
No screen ever shows them that big, so sending the originals would waste a lot
of the visitor's data and make the page slow.

So we keep the originals safe in the `originals/` folders and make **small
copies** that the pages actually use:

- **Two sizes** of each image: a small one for phones, a big one for large or
  high-resolution (retina) screens. The browser automatically picks the right
  one using `srcset` + `sizes` in the HTML.
- **Two formats**: **AVIF** (tiny, modern — most browsers get this) with a
  **JPEG** fallback (works everywhere, incl. link previews).

That turned each photo from ~800 KB down to roughly **10–60 KB**.

### To regenerate the small copies

Only needed if you add or replace a source image. Put the full-size file in the
right `originals/` folder, then run:

```bash
./scripts/build-images.sh
```

It needs three free tools on a Mac:

```bash
brew install libavif webp   # gives you avifenc + dwebp
# sips is already built into macOS
```

The image names, sizes, and quality are all set at the top of that script.

---

## How to run it locally

Because the pages link to each other with folders, open it through a tiny local
web server (not by double-clicking the file). From this folder:

```bash
python3 -m http.server 8000
```

Then visit **http://localhost:8000** in your browser. (In VS Code, the
"Live Server" extension does the same thing with one click.)

---

## Good-to-know details

- **Cache versions:** the `?v=2` at the end of `styles.css?v=2` / `app.js?v=2`
  tells browsers "this is a new version, don't use the old cached one." If you
  change one of those files and it looks stuck, bump the number (`?v=3`) in
  every page that loads it.
- **If JavaScript is turned off:** the fancy camera can't run, so the front page
  shows a small line with a link straight to the Photography section. Nothing
  becomes a dead end.
- **Motion sensitivity:** if a visitor's device is set to "reduce motion," the
  animations are skipped and pages just snap into place.
