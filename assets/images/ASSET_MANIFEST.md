# VibeBridge Image Asset Manifest

This document records the visual assets organized for the VibeBridge application (CIMFEST 2026), detailing their provenance, intended UI usage, dimensions, and processing.

---

## 1. Inventory Summary

| Category | Target Subdirectory | File Name | Status |
| :--- | :--- | :--- | :--- |
| **1. Academy Hero** | `assets/images/academy/` | `academy-drum-kit.jpg` | Organized |
| **2. Rock Foundation Groove** | `assets/images/lessons/` | `rock-foundation-groove.jpg` | Organized |
| **3. Kick and Snare Lesson** | `assets/images/lessons/` | `kick-snare.jpg`<br>`kick-snare-card.jpg` | Organized<br>Cropped Variant |
| **4. Hi-Hat Fundamentals** | `assets/images/lessons/` | `hi-hat-fundamentals.jpg` | Organized |
| **5. Professional Demonstrations** | `assets/images/demonstrations/` | `professional-drummer.jpg` | Organized |
| **6. Music Player Artwork** | `assets/images/player/` | *(None supplied)* | **Missing** |

---

## 2. Asset Details

### Asset 1: Main Academy Drum Kit Hero
- **Final Path:** `assets/images/academy/academy-drum-kit.jpg`
- **Original Filename:** `media_1795462395792_3bd700af.jpg`
- **Preserved Raw File:** `assets/images/originals/media_1795462395792_3bd700af.jpg`
- **Image Category:** Main Academy drum kit hero
- **Intended Screen / Component:** `Academy Home (V2.2)` — Primary Hero Card ("Learn to Play Music")
- **Dimensions:** 800 × 800 px
- **Aspect Ratio:** 1:1 (Square)
- **File Format:** JPEG (24-bit RGB)
- **File Size:** ~126.5 KB (129,500 bytes)
- **Source & Licence Information:** Not supplied in prompt
- **Visual Description & Quality:**
  Full isolated Yamaha acoustic drum kit featuring light wood toms and snare, a black bass drumhead with Yamaha logo, and Paiste bronze cymbals.
- **Processing & Suitability Notes:**
  The image contains a rasterized gray-and-white checkerboard pattern baked into the JPEG pixels (simulating transparency). For production UI or Google Stitch rendering, a transparent PNG/WebP cutout or SVG mask should be keyed so the background blends into light (`#FFFFFF`) or dark (`#111722`) theme cards. Preserved as original JPEG to avoid re-compression loss.

---

### Asset 2: Rock Foundation Groove Lesson
- **Final Path:** `assets/images/lessons/rock-foundation-groove.jpg`
- **Original Filename:** `media_1795462411767_60c4577b.jpg`
- **Preserved Raw File:** `assets/images/originals/media_1795462411767_60c4577b.jpg`
- **Image Category:** Rock Foundation Groove lesson
- **Intended Screen / Component:** `Curriculum Hub` / `Featured Lessons` — Lesson Card 1 (*Rock 4/4 Foundation Groove*)
- **Dimensions:** 1024 × 682 px
- **Aspect Ratio:** 3:2 (Landscape)
- **File Format:** JPEG (24-bit RGB)
- **File Size:** ~350 KB (358,347 bytes)
- **Source & Licence Information:** Not supplied in prompt
- **Visual Description & Quality:**
  High-resolution, warm studio overhead/drummer perspective photograph of a complete acoustic drum set with a red sparkle bass drum, two wooden drumsticks resting horizontally across the snare drum, brass cymbals, bass pedals, and studio condenser microphones.
- **Processing & Suitability Notes:**
  Excellent photographic quality and framing. Directly suitable for full-bleed mobile lesson cards. Copied losslessly to maintain fidelity.

---

### Asset 3: Kick and Snare Lesson
- **Final Path:** `assets/images/lessons/kick-snare.jpg`
- **Cropped Variant:** `assets/images/lessons/kick-snare-card.jpg`
- **Original Filename:** `media_1795462430789_27bda170.jpg`
- **Preserved Raw File:** `assets/images/originals/media_1795462430789_27bda170.jpg`
- **Image Category:** Kick and Snare lesson
- **Intended Screen / Component:** `Curriculum Hub` / `Featured Lessons` — Lesson Card 2 (*Basic Kick and Snare*)
- **Dimensions (Original):** 1024 × 537 px (~1.9:1)
- **Dimensions (Cropped Variant):** 1024 × 450 px (~2.28:1 / wide mobile card)
- **File Format:** JPEG (24-bit RGB)
- **File Size:** ~75.8 KB (77,622 bytes) / Cropped: ~104 KB (106,649 bytes at 95% quality)
- **Source & Licence Information:** Unsplash watermark icon present in top-left corner ($X: 43\text{--}183$, $Y: 44\text{--}190$). Originates from Unsplash. Exact photographer credit and licence terms not supplied.
- **Visual Description & Quality:**
  Close-up photograph of a black Pearl snare drum with chrome hardware and white Remo drumhead on the left, paired with a matching black tom/bass drum on the right.
- **Processing & Suitability Notes:**
  Original file preserved without modification. In addition, `kick-snare-card.jpg` was generated with a top-crop ($Y=87\text{ px}$ offset) that eliminates the Unsplash watermark icon while keeping both drumheads fully in frame and visually prominent for mobile card containers.

---

### Asset 4: Hi-Hat Rhythm Fundamentals Lesson
- **Final Path:** `assets/images/lessons/hi-hat-fundamentals.jpg`
- **Original Filename:** `media_1795462442169_a5811b43.jpg`
- **Preserved Raw File:** `assets/images/originals/media_1795462442169_a5811b43.jpg`
- **Image Category:** Hi-Hat Rhythm Fundamentals lesson
- **Intended Screen / Component:** `Curriculum Hub` / `Featured Lessons` — Lesson Card 3 (*Hi-Hat Rhythm Fundamentals*)
- **Dimensions:** 1000 × 1000 px
- **Aspect Ratio:** 1:1 (Square)
- **File Format:** JPEG (24-bit RGB)
- **File Size:** ~235.2 KB (240,817 bytes)
- **Source & Licence Information:** Not supplied in prompt
- **Visual Description & Quality:**
  Dramatic, warm golden studio close-up of a pair of bronze hi-hat cymbals mounted on a chrome stand and clutch with warm backlighting and concentric lathe grooves.
- **Processing & Suitability Notes:**
  Premium high-contrast visual. 1:1 aspect ratio renders cleanly in square card thumbnails or cropped landscape banners. Copied losslessly.

---

### Asset 5: Professional Demonstrations Thumbnail
- **Final Path:** `assets/images/demonstrations/professional-drummer.jpg`
- **Original Filename:** `media_1795462454122_d5a4446b.jpg`
- **Preserved Raw File:** `assets/images/originals/media_1795462454122_d5a4446b.jpg`
- **Image Category:** Professional Demonstrations thumbnail
- **Intended Screen / Component:** `Academy Home (V2.2)` — Professional Demonstrations Discovery Section
- **Dimensions:** 1024 × 681 px
- **Aspect Ratio:** 3:2 (Landscape)
- **File Format:** JPEG (24-bit RGB)
- **File Size:** ~258.4 KB (264,592 bytes)
- **Source & Licence Information:** Not supplied in prompt
- **Visual Description & Quality:**
  Professional studio portrait of an experienced drummer with dreadlocks smiling behind a natural wood grain Pearl drum kit, holding drumsticks in a sound-treated recording studio.
- **Processing & Suitability Notes:**
  Perfect human element for discovery. Communicates authentic professional mentorship and performance. Copied losslessly.

---

### Asset 6: Music Player Artwork
- **Target Path:** `assets/images/player/music-player-artwork.webp`
- **Status:** **MISSING**
- **Notes:** No image was supplied for the Music Player artwork in the uploaded batch. The `assets/images/player/` directory has been created to hold this asset once provided.

---

## 3. Directory Layout

```
assets/
└── images/
    ├── ASSET_MANIFEST.md
    ├── .gitkeep
    ├── academy/
    │   └── academy-drum-kit.jpg             (800 × 800)
    ├── demonstrations/
    │   └── professional-drummer.jpg         (1024 × 681)
    ├── lessons/
    │   ├── rock-foundation-groove.jpg       (1024 × 682)
    │   ├── kick-snare.jpg                   (1024 × 537, original)
    │   ├── kick-snare-card.jpg              (1024 × 450, watermark-free crop)
    │   └── hi-hat-fundamentals.jpg          (1000 × 1000)
    ├── originals/
    │   ├── media_1795462395792_3bd700af.jpg (800 × 800)
    │   ├── media_1795462411767_60c4577b.jpg (1024 × 682)
    │   ├── media_1795462430789_27bda170.jpg (1024 × 537)
    │   ├── media_1795462442169_a5811b43.jpg (1000 × 1000)
    │   └── media_1795462454122_d5a4446b.jpg (1024 × 681)
    └── player/
        └── (Awaiting supply of music-player-artwork)
```
