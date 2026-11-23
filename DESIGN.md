---
name: RoomFit 3D
description: A Korean apartment sales floor-plan brochure you can edit; tick-ended dimension chains carry every measurement.
colors:
  ink: "#0f2a4a"
  ink-soft: "#33506f"
  muted: "#4a6480"
  navy: "#0f3057"
  navy-deep: "#0a2340"
  canvas: "#eaf0f6"
  canvas-deep: "#dde7f1"
  surface: "#ffffff"
  line: "#c9d6e3"
  line-strong: "#7e97b3"
  accent: "#f2a900"
  accent-soft: "#fdeec4"
  accent-edge: "#c98f00"
  danger: "#c62828"
  danger-ink: "#a71d1d"
  danger-bg: "#fdecec"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 1.2rem + 3.4vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
    fontFeature: "tnum"
  label:
    fontFamily: "Pretendard Variable, Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.01em"
rounded:
  base: "4px"
  tag: "2px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "2px 12px"
    height: "44px"
  button-pressed:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "2px 12px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.navy-deep}"
  button-landing:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    padding: "0 36px"
    height: "52px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "0 10px"
    height: "44px"
  topbar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    padding: "4px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "336px"
  badge-warn:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.base}"
    height: "44px"
  scene-chain:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tag}"
---

# Design System: RoomFit 3D

## Overview

**Creative North Star: "The Sales Floor Plan"**

The product is a Korean apartment sales brochure plan that you can edit. White drawing paper, deep navy ink, a pale plan-blue work ground. Every measurement is drawn the way a drafter would draw it: a tick-ended dimension chain with cm numerals. Controls are plain web controls with square-ish corners and navy outlines; the interface reads as drafting furniture around the plan, never as a styled SaaS shell.

Density is practical and calm. Numerals are tabular and are the most legible thing on screen. Depth is carried by tone and hairline, with one soft pop shadow reserved for floating things. The same grammar runs across landing, editor, trace screen and dialogs.

The brand name "RoomFit 3D" and its mark are provisional (PRODUCT.md). The mark, a drawn room outline over a tick-ended chain on amber, is a placeholder.

**Key Characteristics:**
- Navy ink for linework, type and committed action; plan-blue (#eaf0f6) as the work ground.
- Role-locked color: navy fill = action/commit, amber = selected/on, red = collision, plan-blue = work ground.
- Signature: the tick-ended dimension chain.
- Pretendard Variable, tabular numerals, 4px corners, 44px touch targets.
- Furniture blocks keep per-kind PRD colors, kept muted so the room reads first.

## Colors

A navy-and-paper palette with one warm signal (amber) and one alarm (red); everything else is blue-gray tint steps.

### Primary
- **Deep Drafting Navy** (--navy): top bar, primary buttons, table heads, footer, 3D chain chips. The committed shell.
- **Plotter Navy Deep** (--navy-deep): hover/pressed navy, toast ground, the 3px rule under bars.
- **Drafting Ink** (--ink): body text, wall linework, swatch borders, text on amber.

### Secondary
- **Selection Amber** (--accent): pressed/on state (aria-pressed, current room, current step), focus ring, text selection, favicon ground. Text on it is always ink. Its darker edge (--accent-edge) borders pressed buttons.
- **Amber Wash** (--accent-soft): soft amber tint.

### Tertiary
- **Collision Red** (--danger, --danger-ink, --danger-bg): interference only: warn badge, item warnings, field errors, flagged furniture. Always paired with an icon and text, never color alone.

### Neutral
- **Plan Blue** (--canvas, #eaf0f6): work ground for the 3D canvas, trace stage, plan figure; --canvas-deep for pressed.
- **Drawing Paper** (--surface, #ffffff): panels, modals, landing body.
- **Hairline** (--line) and **Control Edge** (--line-strong): dividers vs. control borders and dimension rules (control edge clears 3:1 on white).
- **Ink Soft / Muted** (--ink-soft, --muted): secondary text and hints, AA on white and plan-blue.

### Named Rules
**The Role Lock Rule.** Navy fill means do/commit, amber means selected or on, red means collision, plan-blue means ground. A color never takes a second job.
**The Amber Is Selection Rule.** Amber never decorates; if nothing is selected or on, amber is absent.

## Typography

**Display, Body and Label Font:** Pretendard Variable (self-hosted, dynamic subset) with Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, system-ui fallback.

**Character:** One workhorse Korean sans in heavy weights for headings and plain weights for text. Tabular numerals globally so cm values align. `word-break: keep-all` for Korean.

### Hierarchy
- **Display** (800, clamp(2.1rem, 1.2rem + 3.4vw, 3.6rem), 1.18, -0.035em): landing h1 only.
- **Headline** (800, 1.5rem, 1.35, -0.02em): landing section h2.
- **Title** (700, 1.0625rem; editor modal h2 17px): sub-heads, step titles, dialogs.
- **Body** (400, 16px, 1.7, max 68ch): landing prose. Editor text is 13-14px.
- **Label** (600-700, 11-14px): panel h2 (13px/700), field labels, hints (13px/1.5), units and dimension text (11-12px).

### Named Rules
**The Numerals First Rule.** Tabular figures everywhere; a measurement is never set smaller than the text around it.

## Layout

Editor: full-viewport column, navy top bar over a row of plan-blue canvas and a 336px white right panel (280px on tablet, collapsible; bottom sheet at 35%/75%/44px-min on mobile). Breakpoints 640px and 1024px (trace layout stacks at 767px). Panel sections stack vertically with no tabs; padding 4px 16px 24px, field grid 84px / 1fr / auto. Landing: 1120px max width, 24px gutters, hero grid 1.05fr/1fr from 960px with copy left and authored plan right, three-up specs from 640px. Spacing rhythm is 6/8/16/24/32px. All interactive targets are at least 44px.

## Elevation & Depth

Mostly flat and tonal: white panels against plan-blue, hairline borders, a 3px navy-deep rule under bars. One soft pop shadow marks things that float, and a second, upward shadow for the mobile sheet.

### Shadow Vocabulary
- **Pop** (`0 6px 16px -4px rgba(10,35,64,0.28), 0 1px 3px rgba(10,35,64,0.18)`): menus, warn list, badge, toast, modal.
- **Landing CTA** (`0 8px 18px -8px rgba(10,35,64,0.55)`): the 시작하기 button only.
- **Scrim** (rgba(10,35,64,0.55)): modal backdrop.

### Named Rules
**The Hairline First Rule.** Separate with a hairline or a tone step before reaching for a shadow.

## Shapes

Square-ish: 4px radius on buttons, inputs, menus, modals, badges, figures; 2px on swatches and 3D labels; pill only for the current trace step; circle only for landing step numbers. Segmented controls share edges with 4px on the outer ends. Borders are 1px control edge by default, 2px navy on the landing CTA and consent buttons.

## Components

### Buttons
- **Shape:** 4px radius, 44px minimum height and width, 600 weight.
- **Default:** white, 1px control-edge outline, ink text; hover plan-blue with ink-soft border.
- **Pressed/current:** amber fill, amber-edge border, ink text.
- **Primary/submit:** navy fill, white text; hover navy-deep.
- **On the navy bar:** 8% white fill, 35% white outline, white text; pressed is amber.
- **Landing CTA:** 52px, 36px side padding, 800 weight, 2px navy border, slight press translateY(1px).
- **Focus:** 3px amber outline, 2px offset, on everything.

### Inputs / Fields
- 44px, 1px control-edge, white, 4px radius; focus shifts the border to navy; error is danger border on danger-bg with a danger-ink message below.

### Navigation
- Navy top bar: wordmark with mark, view segmented control, undo/redo, snap toggle, menu. Menu is a white 4px popover with borderless rows.

### Dimension Chain (signature)
- A 1px control-edge line with 1px end ticks, 9px tall. It appears as the trailing rule on every panel and modal heading, as the top rule of landing details and specs, in the landing hero plan (ink chains with plan-blue chip numerals, drawn in with a 0.9s ease-out unless reduced motion), and in the 3D room as navy chips with white 800 numerals.

### Catalog and Warnings
- Catalog entries are two-up buttons with a 12px kind-colored swatch (ink 1.5px border), name and a small tabular W×D×H line. Furniture blocks use kind colors from the catalog. Warnings are red-tinted rows with an icon plus text. Icons are an inline 20px, 1.8 stroke, round-cap line set.

## Do's and Don'ts

### Do:
- **Do** express every measurement as a tick-ended chain with cm numerals.
- **Do** use navy fill only for primary or committing actions, amber only for selected/on.
- **Do** keep 44px targets, 3px amber focus ring, and pair every red state with an icon and text.
- **Do** keep numerals tabular and surfaces flat with hairlines before shadows.
- **Do** keep furniture colors muted so the plan reads first.

### Don't:
- **Don't** use red for anything but collision.
- **Don't** use blueprint-cyan or a generic blue SaaS editor look.
- **Don't** put amber text on white, or any text on amber except ink.
- **Don't** replace specs or sections with floating cards; separate with a dimension rule.
- **Don't** block placement on a collision; warn only.

## Not canonized (defects the build carries)

Scene code hardcodes its own hex values (e.g. collision #e53935 in Scene.tsx and TraceCanvas.tsx vs. --danger #c62828; door/window blue #5b9bd5 and trace orange/green/pink markers) that are not theme tokens; landing disabled #66788c and failed-save #ffd2d2 are one-offs. They are drift, not system rules.
