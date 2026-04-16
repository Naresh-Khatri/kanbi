# Kanbi Design Principles

A small, opinionated design language for Kanbi. The goal is a UI that feels quiet, fast, and out of the way — so the work on the board can be seen.

## Philosophy

- **Subtract until it breaks, then add one thing back.** A screen should have a single job and the minimum UI needed to do it.
- **Monochrome with alpha, not a palette.** Reach for `white/70`, `white/10`, `white/5` before introducing a new color.
- **Type and space carry the design.** No decorative shadows, no ornamental borders, no gradients inside components.
- **Keyboard-first.** Every primary action has a shortcut, and shortcuts are discoverable.
- **Color is meaning.** Priority, status, focus — that's where color goes. Never decoration.
- **Motion is almost invisible.** Things snap into place; they don't swoop.

## Two surfaces, two dialects

Marketing pages and product pages do different jobs. They shouldn't look the same.

### Marketing / auth surfaces — landing, login, signup

These pages set tone and get out of the way.

- Gradient background: `bg-gradient-to-b from-[#0b0b0f] to-[#15162c]`
- Centered, full-height compositions with generous whitespace
- Display typography: `font-extrabold text-5xl tracking-tight sm:text-6xl`
- Pill CTAs (`rounded-full`) — one primary (solid white), one secondary (hairline outline)
- No product chrome (no sidebars, no breadcrumbs)

### Product surfaces — everything under `/app`

These pages are lived in. They should feel like a tool, not a page.

- Flat near-black background, no gradients
- Hairline borders (`border-white/10`) to separate regions, not shadows
- Corners are `rounded-md` or `rounded-lg` — pill shapes are reserved for filter chips and status badges
- Information density is a feature — prefer smaller type and tighter padding over sparse layouts
- Every interactive element has a keyboard path; visible shortcut hints where space allows

## Typography

- Display (marketing): `font-extrabold tracking-tight`, 5xl–6xl
- Section headings (product): `font-semibold tracking-tight`, base–lg
- Body: default weight, `text-white` for primary, `text-white/70` for secondary, `text-white/40` for meta/disabled
- Line length for prose: cap at `max-w-md` on marketing, `max-w-prose` elsewhere
- Never mix centered and left-aligned text in the same region

## The alpha ladder (on dark)

A small, disciplined set of tokens. Reach for these before introducing a new color.

| Purpose         | Token                                         |
| --------------- | --------------------------------------------- |
| Primary text    | `text-white`                                  |
| Muted text      | `text-white/70`                               |
| Meta / disabled | `text-white/40`                               |
| Hairline        | `border-white/10`                             |
| Emphasis border | `border-white/20`                             |
| Hover fill      | `bg-white/5` (dense) / `bg-white/10` (sparse) |
| Pressed fill    | `bg-white/15`                                 |

Color is reserved for **meaning**: priority, status, urgency, focus ring. Decorative color is not a thing here.

## Buttons

Always `transition`, never scale or shadow on hover.

- **Primary (marketing)** — solid white, black text, pill:
  `rounded-full bg-white px-6 py-2.5 font-medium text-black transition hover:bg-white/90`
- **Secondary (marketing)** — hairline pill:
  `rounded-full border border-white/20 px-6 py-2.5 font-medium transition hover:bg-white/10`
- **Product button** — compact, rectangular, hairline:
  `rounded-md border border-white/10 px-3 py-1.5 text-sm transition hover:bg-white/5`
- **Ghost / icon button** — no border, just hover fill:
  `rounded-md p-1.5 transition hover:bg-white/5`

One primary per row. Icons inside product buttons are fine and expected; inside marketing CTAs, only if the label would otherwise be ambiguous.

## Motion

- Default transition duration. No bespoke easing curves unless there's a reason.
- No entrance animations on static content.
- Drag, open, and confirm get motion. Scroll, hover, and navigation don't.
- If a motion feels "designed," it's probably too much.

## Keyboard-first

Non-negotiable for a tool like this.

- Every primary action has a shortcut, and the shortcut is discoverable (tooltip, command palette, or visible hint).
- `Cmd+K` is the command palette. It should eventually do anything a mouse can.
- Single-key shortcuts (`c` to create, `/` to search, `esc` to dismiss) are encouraged inside the product.
- Focus rings stay visible — `ring-white/40` or the focus accent. Never removed.

## The test

If a screen has more visual weight than it needs to do its one job, pull something out and ship it again.
