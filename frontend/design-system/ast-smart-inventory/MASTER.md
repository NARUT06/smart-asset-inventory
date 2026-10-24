# AST Smart Inventory — MASTER Design System
_Generated with UI UX Pro Max skill (`search.py "asset inventory management dashboard enterprise" --design-system). Single source of truth._

## Pattern
Feature-Rich Showcase adapted to app shell: clear feature hierarchy, one key message per card.

## Style
**Flat Design** — 2D, minimalist, bold flat colors, no shadows/gradients, clean lines, icon-heavy, typography-focused.
- Light mode only. Performance cost: low. Accessibility risk: low (contrast-text 4.5, keyboard, visible-focus, reduced-motion).

## v3 identity — CryptiQ admin (user-approved dashboard language, applied site-wide)
- Sidebar stays deep navy gradient in both themes; active nav = orange pill (`#f59e0b` light / `#fbbf24` dark, dark text `#1a1005`).
- Global CTA = orange (`--color-accent`); primary buttons use dark text on orange for contrast.
- Tables: navy header row + 2px orange underline; row hover warm tint (light) / navy lift (dark).
- Login: navy backdrop + orange gradient hero panel.
- Dashboard `.dq-*` keeps the CryptiQ showcase (dark navy in dark mode, white in light mode) with orange CTA.
- Sources: skill `dark-mode-oled` (dark surfaces/accents) + Polaris-style admin hierarchy/semantic status.

## Colors — skill palette (`search.py "enterprise asset management dashboard" --domain color`)
| Token | Light (CRM palette) | Dark (Financial/IoT palette) |
|---|---|---|
| primary / on | `#1E293B` / `#FFF` | `#F8FAFC` (text) |
| accent / on | `#059669` / `#FFF` | `#22C55E` / `#0F172A` |
| background | `#F8FAFC` | `#0F172A` |
| card | `#FFFFFF` | `#1B2336` |
| muted / muted-fg | `#F1F5FD` / `#475569` | `#272F42` / `#94A3B8` |
| border | `#E4ECFC` | `#475569` |
| destructive | `#DC2626` | `#EF4444` (alerts) |
| Notes | slate + emerald enterprise trust | dark slate + status green |

## Typography
- Latin: **Lexend** (headings/numbers) / **Source Sans 3** (body)
- Arabic: **Cairo** (fallback chain: `"Lexend","Cairo","Source Sans 3",Tahoma,sans-serif` — Arabic glyphs fall through to Cairo automatically)
- Google Fonts import in `index.html`.

## Effects
- No gradients, no shadows (flat). Hover: color/opacity shift only. Transitions 150–200ms ease.
- `prefers-reduced-motion` disables transitions.

## Dark theme (UI UX Pro Max `dark-mode-oled` guidance)
- Surfaces: deep slate `#0B1220` page, `#111A2E` cards/sidebar, borders `#24314D`.
- Text: `#E8EDF7` primary, `#9AA7C2` muted. Contrast ≥ 7:1 for body text.
- Accents stay vibrant on dark: emerald → `#34D399`, sky `#38BDF8`, amber `#FBBF24`, rose `#FB7185`, violet `#A78BFA`, teal `#2DD4BF`.
- Minimal glow only on active nav/focus ring. No pure-white backgrounds. `color-scheme: dark`.
- Tokens implemented as `[data-theme="dark"]` overrides in `src/styles.css`; toggle persisted in `localStorage (ast_theme)`, defaults to OS `prefers-color-scheme`.

## Avoid
Excessive decoration, complex shadows, 3D effects, emojis as icons (inline SVG only).

## Pre-delivery checklist
- [x] SVG icons, no emojis
- [x] cursor-pointer on clickables
- [x] 150–200ms hover transitions
- [x] contrast ≥ 4.5:1, visible focus
- [x] reduced-motion respected
- [x] responsive 375 / 768 / 1024 / 1440
