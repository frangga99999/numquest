# Playful Retro Game System — NumQuest v1

Implementation of the supplied retro geometry brief, adapted to arithmetic learning.
The reference images guide color, weight and geometry; logos and brand assets are original NumQuest compositions.

## Architecture

- `src/design-system/tokens.css`: primitive → semantic → component tokens.
- `src/design-system/RetroUI.jsx`: reusable React components, no game state dependency.
- `src/design-system/retro-ui.css`: component styling and expression levels.
- `src/design-system/numquest-theme.css`: adapters for existing NumQuest screens.
- `src/design-system/DesignSystem.jsx`: interactive component and pattern gallery.

Open **Lainnya → Playground UI kit**, the desktop sidebar link, or `/#design-system`.
Home, Foundation lesson components, Academy, and the game dashboard use the new
visual vocabulary. Existing lesson state and game logic remain in their original modules.

## Foundations

| Layer | Example |
| --- | --- |
| Primitive | `--pr-green-950`, `--pr-pink-200`, `--pr-space-6` |
| Semantic | `--pr-action`, `--pr-text`, `--pr-positive` |
| Component | `--pr-button-bg`, `--pr-button-radius`, `--pr-card-bg` |

Palette: forest #062f28, green #62d361, pink #f3c8e8, lavender #c4c1f4,
yellow #f9e870, mint #d9eee4, cream #f7f5eb. Pink/lavender are expressive surfaces,
not status meanings. Text on pastel surfaces is forest, including dark previews.

Typography uses Avenir Next with local fallbacks, heavy headings and normal-weight
body copy. No network font dependency. Numeric HUD content uses tabular figures.
Spacing follows 4px units; card gaps 16–24px; card radius 24px; buttons use capsules.
Elevation is a small hard offset, not a glow or glass blur.

## Public components

| Component | Properties / responsibility |
| --- | --- |
| Button | primary / secondary / tertiary / danger; sm / md / lg; disabled / loading; expression; native button props |
| GameCard | media, eyebrow, badge, title, description, children, footer slots; tone; expression; `as` |
| Badge | neutral / positive / negative / warning; always supply readable status text |
| Shape | clover / spark / arch / circle; decorative SVG hidden from assistive technology |
| Progress | value, max, accessible label; clamped value |
| Resource | symbol, value, label; shared numeric counter for score/currency/lives/time |
| Segmented | options, controlled value/onChange; pressed button group |
| Field | label, unique id, error; native input props |
| Toggle | label, controlled checked/onChange; keyboard accessible native checkbox |
| Dialog | open, onClose, title, content; native modal focus behavior and Escape |

Card compositions demonstrated: mission, locked level, daily reward, quiet HUD.
Patterns demonstrated: claim → claimed, input validation, exit confirmation,
feedback toast, theme selection, and reduced motion. Reward demo does not alter
real game balances. Light/dark switches apply to the gallery, not the whole app.

## Expression and motion

- Quiet: questions, forms, HUD. No decorative motion near answer entry.
- Playful: home, mode selection, missions. One large shape and one dominant color.
- Celebration: reward surfaces, hard offset shadow and higher contrast.
- Press: 140ms; state change: 220ms; restrained home entrance up to 500ms.
- Respect OS reduced motion. The gallery also has a local reduced-motion toggle;
  Foundation retains its existing reduced-motion preference.

## Accessibility and responsive behavior

Readable labels accompany status colors. Buttons target 44–56px. Visible keyboard
focus is orange with a 4px offset. Native dialog traps focus and supports Escape.
Forms connect error descriptions to their inputs. Navigation and progress expose
semantic state. Mobile uses bottom navigation; desktop uses the existing sidebar.
Academy becomes a single-column module list on narrow screens.

## Scope

This is a working first version, not the speculative 180–220 asset inventory from
the brief. No Figma library, 40-screen template pack, joystick, payment flow or
matchmaking system is claimed. The reusable foundation supports those extensions
without adding nonfunctional controls to NumQuest. The game dashboard is adapted;
its secondary legacy pages retain some original game-specific visuals.

## Verification

Production build plus browser checks for home on mobile/desktop, Academy navigation,
gallery theme changes, validation, reward claim state, and dialog Escape behavior.
