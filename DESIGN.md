# Kanbi Design Principles

Kanbi's UI is built entirely on **[coss ui](https://coss.com/ui)** (Base UI + Tailwind v4). The goal is unchanged: a UI that feels quiet, fast, and out of the way so the work on the board can be seen. coss supplies the primitives and the design system; this file says how Kanbi uses them.

- Docs map: https://coss.com/ui/llms.txt (every page is markdown at `<url>.md`)
- Agent skill: `npx skills add cosscom/ui` (source: `apps/ui/skills/coss` in github.com/cosscom/ui)
- Particles (composition examples): https://coss.com/ui/particles

## Rules

1. **coss first, always.** If coss has a primitive for it, use it. Never hand-roll dialogs, menus, popovers, selects, tooltips, toasts, tabs, avatars, badges, cards, empty states, spinners or skeletons.
2. **`src/components/ui/` is coss-only.** Files there come from `pnpm dlx shadcn@latest add @coss/<name>`. Update with the CLI; don't fork them for one screen. Customize at the call site with `className`, or compose a domain component elsewhere.
3. **Domain components live with their route** (`_components/`) or in `src/components/<domain>/` when shared (`brand/logo`, `rich-text/*`, `user-avatar`, `command/*`). They compose coss parts. They never re-implement them.
4. **Semantic tokens only.** Use `text-foreground`, `text-muted-foreground`, `bg-background`, `bg-card`, `bg-popover`, `bg-accent`, `bg-muted`, `border` (default color), `border-input`, `text-destructive-foreground`, `bg-destructive`, plus `info` / `success` / `warning` (`text-*-foreground` for text, `bg-*/8` or `/16` tints). No `white/xx`, no hex, no Tailwind palette colors in components. The one Kanbi addition is `ai` / `ai-foreground`, used only for AI-drafted content.
5. **Color is meaning.** Priority, status, due-ness, AI, destructive. Data colors (labels, project color) come from the DB as inline `style`. Never decorate.

## Primitive choices

| Need | Use |
| --- | --- |
| Modal task / form | `Dialog` (`DialogPopup` › `DialogHeader` › `DialogPanel` › `DialogFooter`) |
| Destructive confirm | `AlertDialog` |
| Side panel (task detail, digest, archive) | `Drawer` (`position="right"`). `Sheet` is deprecated in coss, don't use it |
| Actions on a thing | `Menu` (`MenuTrigger render={<Button …/>}`, `MenuItem onClick`) |
| Right-click on cards/columns | `ContextMenu`, mirroring the `Menu` items |
| Pick one from a short list | `Select` (items-first) |
| Pick from a long or searchable list (assignee, labels, column) | `Combobox` (`multiple` for labels) |
| Rich floating content | `Popover`; link previews → `PreviewCard` |
| Icon-only button | `Button size="icon*" variant="ghost"` + `Tooltip` (with `Kbd` when there's a shortcut) + `aria-label` |
| Notifications | `toastManager.add({ type, title, description, actionProps })`, not Sonner |
| Undo | toast with `actionProps: { children: "Undo", onClick }` |
| View switchers | `Tabs` (pages) / `ToggleGroup` (inline view or filter modes) |
| Forms | `Form` + `Field` › `FieldLabel` / `Input` / `FieldDescription` / `FieldError` |
| Inputs with icons/buttons | `InputGroup` |
| Boxes / sections | `Card` (+ `CardHeader`/`CardPanel`/`CardFooter`) or `Frame` for list containers |
| Empty states | `Empty` › `EmptyHeader` › `EmptyMedia variant="icon"` / `EmptyTitle` / `EmptyDescription` / `EmptyContent` |
| Status / label chips, counts | `Badge` (`variant` = outline / secondary / info / success / warning / error) |
| Loading | `Skeleton` for layout, `Spinner` or `Button loading` for actions |
| Command palette | `Command` (coss Autocomplete-based) |
| Lists of rows (members, devices, archive) | `Frame` / `Table` |
| App navigation | One slim top bar (`AppHeader`): logo, project switcher + section tabs, search, inbox, avatar. No sidebar; ⌘K and project jumps cover navigation |

## Composition conventions (Base UI, not Radix)

- `asChild` → `render`: `<DialogTrigger render={<Button variant="outline" />}>Open</DialogTrigger>`; links: `<Button render={<Link href="…" />}>`.
- Menu items use `onClick`, not `onSelect`.
- Footer cancel/close buttons in Dialog/AlertDialog/Drawer are `variant="ghost"`; `outline` is for buttons that open overlays.
- Icons: `aria-hidden="true"` when decorative. No numeric `size` props: primitives size their SVGs, override with `size-*` only when needed.
- Prefer parent `flex gap-*` over `space-y-*`; logical spacing (`ms-*`, `pe-*`); `size-*` for squares; `cn()` for conditionals; `in-[[data-slot=…]]` over `group`.

## Dialects

- **Product (`/app`, `/b`)**: dense, flat, hairline borders, one top bar and full-width content. Small type (`text-sm`/`text-xs`), `size="sm"` controls in toolbars.
- **Marketing / auth (`/`, `/login`, `/signup`, `/docs`, `/invite`)**: same tokens and components at larger sizes (`Button size="lg"`, `font-heading` display type), centered compositions, generous space. No product chrome.

## Motion (Emil Kowalski's rules)

- Let coss primitives own overlay motion (origin-aware, `ease-out`, under 250ms).
- No animation on keyboard-initiated or 100x/day actions (command palette, shortcuts, hover).
- Drag, open and confirm get motion. Scroll, hover and navigation don't.
- Animate only `transform`/`opacity`; respect `prefers-reduced-motion`.

## Keyboard-first

- Every primary action has a shortcut (`react-hotkeys-hook`), shown with `Kbd` in tooltips, menus (`MenuShortcut`) and the command palette.
- `Cmd+K` palette, `c` create, `/` search, `g h` home, `Alt+1-9` jump to a project, `esc` dismisses.
- Focus rings stay visible (coss defaults). Never remove them.

## The test

If a screen has more visual weight than it needs to do its one job, pull something out and ship it again.
