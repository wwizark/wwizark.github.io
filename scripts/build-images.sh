#!/usr/bin/env bash
# Regenerates responsive image derivatives from the full-resolution originals
# kept in each section's originals/ folder.
#
# Why: the originals are 6192x4128 (~800 KB each) but are never shown wider
# than ~750 CSS px. Shipping the originals wastes megabytes on every visit.
#
# What we make, and why so few files:
#   * Two formats: AVIF (the modern <source>, smallest, ~95% of browsers) and
#     JPEG (the universal <img> fallback for everything else, incl. link/social
#     scrapers). WebP is skipped — JPEG already covers the browsers AVIF misses.
#   * Two widths per image: a small one for phones and a large one for desktop
#     / retina (2x) screens. The browser picks via srcset + sizes.
#
# Layout:
#   assets/photography/originals/*.jpeg  ->  assets/photography/<name>-<w>.{avif,jpeg}
#   assets/camera/originals/*.webp       ->  assets/camera/<name>-<w>.{avif,jpeg}
#
# Requirements (macOS): sips (built in), avifenc + dwebp
#   (`brew install libavif webp`).
# Run from the repo root:  ./scripts/build-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

AVIF_Q=58   # avifenc quality (0..100); ~58 is visually clean and small
JPEG_Q=80   # sips JPEG fallback quality

# encode <out-dir> <source-file> <base-name> <space-separated widths>
# sips can't resample WebP, so decode any .webp source to PNG first.
encode() {
  local out_dir="$1" src="$2" base="$3"; shift 3
  if [[ "$src" == *.webp ]]; then
    local decoded="$TMP/${base}-source.png"
    dwebp -quiet "$src" -o "$decoded"
    src="$decoded"
  fi
  for w in "$@"; do
    local png="$TMP/${base}-${w}.png"
    sips -Z "$w" "$src" --out "$png" >/dev/null
    sips -s format jpeg -s formatOptions "$JPEG_Q" "$png" --out "$out_dir/${base}-${w}.jpeg" >/dev/null
    avifenc -q "$AVIF_Q" -s 6 "$png" "$out_dir/${base}-${w}.avif" >/dev/null
    echo "  ${base}-${w}  ($(du -h "$out_dir/${base}-${w}.avif" | cut -f1) avif)"
  done
}

echo "Photography stills (800 / 1600):"
encode assets/photography assets/photography/originals/M000099.jpeg M000099 800 1600
encode assets/photography assets/photography/originals/M000575.jpeg M000575 800 1600
encode assets/photography assets/photography/originals/M000703.jpeg M000703 800 1600

echo "Camera hero (480 / 960):"
encode assets/camera assets/camera/originals/camera-front.webp camera-front 480 960

echo "Done."
