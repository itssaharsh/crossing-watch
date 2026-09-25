---
version: alpha
name: Crossing Watch
description: A call for each named river crossing in Juja (cross, wait or reroute), readable like a road sign through a wet phone screen.
colors:
  primary: "#0B67A3"
  canvas: "#E3E7E7"
  surface-1: "#F0F3F3"
  surface-2: "#D4DADB"
  line: "#B3BCBE"
  ink: "#0E1A20"
  ink-muted: "#4B5A5F"
  accent: "#0B67A3"
  accent-ink: "#FFFFFF"
  rain: "#2C7FB8"
  cross: "#1B7340"
  cross-text: "#1B6B3C"
  wait: "#F0A500"
  wait-text: "#7A5200"
  reroute: "#C42B1C"
  reroute-text: "#B02617"
  nocall: "#5B676B"
  on-signal: "#FFFFFF"
  murram: "#9A4A26"
typography:
  sign-verb:
    fontFamily: Barlow Condensed
    fontSize: 96px
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: 0.01em
  sign-name:
    fontFamily: Barlow Condensed
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: 0em
  display:
    fontFamily: Barlow Condensed
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.01em
  h2:
    fontFamily: Barlow Condensed
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 0em
  h3:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.08em
  button:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1
  mono:
    fontFamily: Atkinson Hyperlegible Mono
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  mono-lg:
    fontFamily: Atkinson Hyperlegible Mono
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 3px
  md: 6px
  lg: 10px
  device: 44px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "12": 48px
  "16": 64px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  panel-meta:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-primary-hover:
    backgroundColor: "#095A8F"
    textColor: "{colors.accent-ink}"
  button-primary-press:
    backgroundColor: "#074C79"
    textColor: "{colors.accent-ink}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-sign:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-signal}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 56px
  link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.accent}"
  sign-cross:
    backgroundColor: "{colors.cross}"
    textColor: "{colors.on-signal}"
    typography: "{typography.sign-verb}"
    rounded: "{rounded.lg}"
  sign-wait:
    backgroundColor: "{colors.wait}"
    textColor: "{colors.ink}"
    typography: "{typography.sign-verb}"
    rounded: "{rounded.lg}"
  sign-reroute:
    backgroundColor: "{colors.reroute}"
    textColor: "{colors.on-signal}"
    typography: "{typography.sign-verb}"
    rounded: "{rounded.lg}"
  sign-nocall:
    backgroundColor: "{colors.nocall}"
    textColor: "{colors.on-signal}"
    typography: "{typography.sign-verb}"
    rounded: "{rounded.lg}"
  chip-cross:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.cross-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 24px
  chip-wait:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.wait-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 24px
  chip-reroute:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.reroute-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 24px
  rain-bar:
    backgroundColor: "{colors.rain}"
  bucket-water:
    backgroundColor: "{colors.rain}"
  map-contour:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.murram}"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 40px
  skeleton:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
  divider:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ink}"
---

## Overview

**Drift Post.** A "drift" is what Kenyans call a low-water crossing: the road dips down into a stream bed. Many have a painted depth post beside them. Crossing Watch is built from that scene: overcast rain-light grey, storm ink, rain blue, murram-red contour lines, and one loud thing, **the decision sign**. On the phone, the call for a crossing fills the screen like a road sign: green CROSS, amber WAIT, red REROUTE. A rider should be able to read it at arm's length, in rain, on a cheap Android phone.

Everything else is quiet. Color is used only for meaning (rain, the three decisions, murram contours on the map), so when something turns red, nothing else on screen competes with it.

Personality: precise. Snappy, no bounce, hard stops. One exception is the signature transition: when a crossing gets worse, the new sign color rises from the bottom like water, and when it gets better, the old color drains away.

## Colors

- **Canvas (#E3E7E7):** overcast rain-light grey, faintly tinted toward the rain hue. Page background. Never pure white.
- **Surface-1 (#F0F3F3):** panels, cards, list rows, the phone screen background.
- **Surface-2 (#D4DADB):** hover, pressed rows, skeleton blocks, inactive segments.
- **Line (#B3BCBE):** 1px borders and chart gridlines (at 50%). Never used for text.
- **Ink (#0E1A20):** storm ink. All primary text, the focus ring, the ink button used on signs.
- **Ink-muted (#4B5A5F):** secondary text, timestamps, axis labels. Passes AA on canvas, surface-1 and surface-2.
- **Accent / primary, rain blue (#0B67A3):** the brand. It marks the single primary CTA per view, the active tab indicator, links and selection. Never on the decision sign. At most one accent-filled button per view.
- **Rain (#2C7FB8):** data color for rainfall: hyetograph bars and the water in each depth post. Fill-only; use accent for text.
- **Cross (#1B7340), Wait (#F0A500), Reroute (#C42B1C):** decision colors. Fills for the sign, markers and chip dots. Text variants: cross-text #1B6B3C, wait-text #7A5200, reroute-text #B02617. Amber is fill-only; on canvas it always gets a 2px ink ring (1.67:1 alone).
- **No call (#5B676B):** gauge fault or no data. Always paired with a 45° hatch so it never reads as a fourth decision.
- **Murram (#9A4A26):** Kiambu's red laterite soil. Used only for map contour lines (at 35%) and unpaved roads. Never a UI color.
- **On-signal (#FFFFFF):** text on cross, reroute, nocall and accent fills.

Contrast (checked): ink/canvas 14.2:1 (APCA Lc 90) · muted/canvas 5.76:1 (Lc 70) · accent/canvas 4.84:1 · white on reroute 5.66:1 · ink on wait 8.5:1 · white on cross 5.88:1.

## Typography

- **Barlow Condensed** (display): road-sign lineage (drawn from California highway and plate lettering). Used for the sign verb (CROSS / WAIT / REROUTE), crossing names, section titles and big numbers. The sign verb is always uppercase, 800, sized to fill its container (max 96px, min 48px).
- **Atkinson Hyperlegible Next** (body and UI): designed by the Braille Institute so similar letters (I/l/1, 0/O) can't be confused. That is the reason: text read through a rain-spotted screen. 16px minimum for body on mobile.
- **Atkinson Hyperlegible Mono** (numbers and data): mm, mm/h, timestamps, percentages. Always `tabular-nums`.
- Scale 1.25 in UI chrome. Labels: 12px, 700, uppercase, +0.08em, at most one label eyebrow per three sections.
- Copy is sentence case, except the sign verb. Units always carry a non-breaking space ("31 mm", "~2 h"). Use real dashes in names: "Kimbo–Matangi" (en dash).

## Layout

4px base. Tight gaps inside a group (4–8px), generous gaps between groups (20–32px).

- **Replay (/replay, ≥1200):** 56px top bar, then two columns: one replay panel (a 48px county-warning line, the map filling the rest, a 116px replay strip: controls left, hanging rain bars right) · a 380px phone column. Gutters 24px. 768–1199: same, phone column 300px. The map fills its panel by widening its view into the basemap margin; it never letterboxes.
- **Landing (/):** a 7/5 hero (headline + two actions left, the live rider app looping the storm right, over Juja's river lines), then proof ribbons on a surface-1 band, three steps, known/unknown, and an ink close carrying the river texture.
- **Phone / mobile (<768):** the rider app full-bleed, 16px side gutters, sticky 56px tab bar above the safe area, touch targets 44px or more (report buttons 56px).
- Components respond to their container (`@container`), not the viewport; the phone app renders identically inside the stage frame and on a real phone.

## Elevation & Depth

Flat by default: panels are surface-1 with a 1px line border and no shadow. Only two things float:
- **Phone device frame:** two-layer shadow `0 2px 4px ink/6%, 0 24px 48px -12px ink/28%`.
- **Popovers, the command palette and toasts:** `0 2px 4px ink/6%, 0 12px 32px -8px ink/20%`.
The decision sign has no shadow. It gets its depth from a 3px inset white border, like a real road sign.

## Shapes

- Radius scale: **3px** chips and tags · **6px** buttons, inputs, list rows · **10px** panels, cards and the sign · **44px** device frame only.
- Child radius = parent radius − padding (sign inner pill: 10 − 6 = 4px).
- Depth posts are square-cornered: they're painted wood.
- Map markers are depth posts, not pins or circles.

## Components

- **Decision sign:** full-width rounded rect, 3px inset white border (ink on amber). Contents top to bottom: crossing name (sign-name), verb (sign-verb), one reason line (h3 22px), one action line inside a white pill (reroute only), footer data (mono 13px, 85% opacity).
- **Depth post:** a vertical 10mm-banded post (ink and white, alternating), filling with rain-blue water to the bucket level. The learned trigger is a translucent red band (10–90% credible range) with a solid tick at the median. Reports sit as ticks on the left edge: green = seen clear at that level, red = seen flooded.
- **Buttons:** primary = accent fill + white label. Report buttons = 56px tall, surface-1, 2px border in the decision text color, a glyph plus a one-word label ("Flooded", "Clear").
- **Status chip:** 24px tall, background = the decision color at 13% over surface-1, 8px decision-colored square dot + uppercase label in the decision text color.
- **Hyetograph:** rain bars hang from the top axis (hydrology convention), one bar per 15 min, rain-blue; the replay playhead is a 2px ink line; faults are 45° hatches in nocall.

## Do's and Don'ts

- Do keep color for meaning. If a color doesn't mean rain, a decision or soil, it's ink or grey.
- Do write the decision as a verb plus a place: "REROUTE · use Theta Road".
- Do say how sure the call is, in words first ("likely", "may"), then numbers.
- Don't put the accent blue on a decision sign, or a decision color on a button.
- Don't use pins, circles or droplet icons for crossings; they are posts.
- Don't use gradients, glass, glows or drop shadows on panels.
- Don't animate on a timer. Motion only follows replay steps, status changes and taps.
- Don't show a decision without its data freshness ("gauge 2 min ago" or "replay").
- Don't say CROSS when the gauge is faulty. Downgrade to NO CALL or WAIT.
- Don't use emoji or sparkle icons for "AI"; the model is described in plain words ("learned from 3 reports").
