# Development checklist: customization expansion

The working record of the "Feature Expansion" (themes, card designs, roulette animations, sound packs,
custom colors, the Customize screen, Buy Me a Coffee), kept up to date after every phase. Everything in
it is free: no tiers, no unlocks, no limits. Buy Me a Coffee is an optional tip and nothing more.

## Phase 1: what was inspected (architecture summary)

Break Room Arcade is **host-authoritative**. Nothing a player can click decides a result.

```
 webview (React + Vite)                      extension host (Node)
 ┌──────────────────────────┐   messages    ┌─────────────────────────────────────────┐
 │ pages / components / CSS │ ───────────▶  │ WebviewHub: validates every message     │
 │ sound (Web Audio)        │ ◀───────────  │ BlackjackTable / RouletteTable (secrets)│
 └──────────────────────────┘  typed guards │ BreakRoomStore (wallet, stats, history)    │
                                            │ SettingsStore (preferences)             │
                                            │ ResetCoordinator (confirmed resets)     │
                                            └─────────────────────────────────────────┘
                                                           │ globalState (own keys)
```

| Layer | Where | Notes |
| --- | --- | --- |
| Pure game rules | `src/game/blackjack/engine.ts`, `src/game/roulette/engine.ts` | Injectable RNG, no I/O. Fuzzed against an independent reference (`referenceRules.ts`). |
| Tables | `src/game/*/table.ts` | Own the deck / the wheel's choice, pay through `BreakRoomStore` exactly once. |
| Wallet and records | `src/state/*` | `BreakRoomStore` (key `breakRoom.state`) and `SettingsStore` (key `breakRoom.settings`), both through a coalescing `WriteQueue`. |
| Protocol | `src/shared/messages.ts` | Every message in both directions has a runtime guard. A bad message is dropped. |
| Webview shell | `src/webview/App.tsx` | Pages: home, blackjack, roulette, statistics, settings (and customize). One host connection. |
| Sound | `src/webview/sound/*` | Synthesized Web Audio cues. Nothing plays before the player's first click. |
| Styling | `src/webview/styles/*.css` | One token set in `global.css` (`--c-*`, `--px`, `--text-scale`), applied everywhere. |

**Preferences already persisted:** sound, volume, animations, reduced motion, text size. They live in
their own key so no reset can touch them, and are read leniently (`sanitizeSettings`).

**Where the expansion plugs in**

* `Settings` gets the new fields; `sanitizeSettings` fills a default for any that is missing, so old
  saved settings keep working (`SETTINGS_VERSION` 2).
* Theme and colors become CSS custom properties on the page root, so every screen follows without a
  restart (`src/webview/customization/appearance.ts`).
* Card designs, roulette animations and sound packs are data tables with a typed id, picked from
  settings; the game rules never read them.
* The Customize screen (`src/webview/pages/Customize.tsx`) is one more page in the navigation.

## Phase checklist

Status: `[x]` done and verified, `[~]` in progress, `[ ]` not started.

### Before the phases: the three fixes that came first

- [x] Blackjack: split is allowed on any two cards of the same value (K+Q, 10+J), not only the same rank. Fuzzed against an independent rulebook (100,000 rounds, engine and wallet).
- [x] Blackjack flows re-checked: deal, hit, stand, double (also after a split), split (up to 4 hands, split aces get one card), natural 3:2, push, bust, dealer 17.
- [x] Text is easier to read: brighter secondary text (9.5 to 1), bigger type, card corner indexes, a Text size setting (normal / large / extra large), checked from 170px to 700px wide.
- [x] Roulette: SPIN is always on screen (pinned bar), bets on any number 0 to 36 (35 to 1) as well as on a color. Blackjack's DEAL / HIT / STAND are pinned the same way.

### Phase 1: inspect and summarize

- [x] Architecture summary (above).
- [x] Persistence, navigation, sound, motion and theming entry points identified.

### Phase 2: Themes (8)

- [x] Classic Felt, Neon Arcade, Retro 8-Bit, Midnight Felt, Crimson Felt, Cyber Felt, Forest Felt, Royal Felt (`src/webview/customization/themes.ts`: one table of colors per theme)
- [x] Applied through CSS custom properties on the page root, so home, Blackjack, Roulette, buttons, panels, chips and the Home table art all follow; per-theme backdrop pattern, glow and frame metal in `themes.css`
- [x] Selection screen (Style tab) with a live miniature of each theme and an IN USE marker
- [x] Persisted (`settings.theme`), switches without a restart (verified in the browser)
- [x] Every theme passes the contrast guard (main text, secondary text, accents and amounts on the page, the panels and the table; button labels; red suits on a card)
- [~] The roulette wheel's rim, hub and bowl follow the theme: done together with Phase 4

### Phase 3: Playing card designs (6)

- [x] Classic Pixel, Retro 8-Bit, Neon, Medieval Fantasy, Minimal Pixel, Dark Deck (`customization/cardDesigns.ts`, `styles/cards.css`; Classic is the original card, byte for byte)
- [x] All 52 cards in every design plus a back per design, readable values (ink on face >= 4.5 to 1 in every design, tested), deal and flip animations unchanged and still switched off by calm / off motion
- [x] Choice grid with a miniature hand per design, a preview section for the design in use, persisted, verified with a real K+Q split in the browser

### Phase 4: Roulette animations (5)

- [x] Classic Spin, Arcade Spin, Neon Spin, Pixel Explosion, Slow Motion (`customization/rouletteAnimations.ts`; durations 5.5 s, 3.2 s, 5 s, 4.8 s, 9 s)
- [x] Lands on the host's pocket for all 37 pockets in every style (tested at 9 start positions each; the landing never reads the style), the classic wheel is pixel-identical to before (checksum test)
- [x] No second spin while one is running (every bet control and SPIN are disabled and a click is refused), calm and off motion show no movement or burst, persisted
- [x] The wheel's rim, hub and bowl follow the theme, on the game screen and on the Home art

### Phase 5: Sound packs (5)

- [x] Classic Lounge, Retro Arcade, Pixel Adventure, Neon Cyber, Minimal Sounds (`sound/packs.ts`; Classic is tone-for-tone the old sound)
- [x] Click, chip, deal, flip, win, big win, loss, push, spin and a new navigation sound
- [x] Master toggle, volume, five category switches, PLAY SAMPLE, no autoplay (no audio context before the first click, tested)
- [x] Local only: synthesized with Web Audio; a source scan test forbids fetch, XHR, audio files and external URLs
- [ ] Not heard by a person: the packs were checked for what they schedule, not for how they sound

### Phase 6: Custom colors

- [x] Table, background, accent, main button, text, chip
- [x] Six presets, a color picker plus a typed hex box per color, a live preview, reset to the theme's colors
- [x] Readability enforced: text reads at 4.5 to 1 on the page, the panels and the table whatever is picked (tested over thousands of extreme combinations on every theme); a pick that had to be nudged is flagged on screen

### Phase 7: Buy Me a Coffee (REMOVED in 0.2.2)

- [x] Built and verified earlier: a pixel coffee button on Home and in the About card, opening the page through `vscode.env.openExternal`, the address in one constant (`src/shared/support.ts`).
- [ ] Removed in 0.2.2 to test whether a web address in the package was behind the Marketplace rejection. The extension now contains no website at all (`productionBundle.test.ts` fails if one appears). To bring it back, restore the files from commit 6541251 (`SupportButton.tsx`, `support.ts`, the `openSupport` message, the `.support` and `.px-button--support` styles) after an upload has been accepted.

### Phase 8: Persistence and testing

- [x] Missing, invalid and outdated saved settings fall back safely (version 1 settings load with every new option at its default; each field is read on its own)
- [x] Unit tests for the settings model, the resolver, the presets, the tabs and the page
- [x] Integration tests in real VS Code (two new ones: every appearance setting saved and applied by both views; unknown looks, half a category set and bad colors refused) and the restart test now covers every new setting

### Phase 9: Full VS Code testing

- [x] Sidebar and panel (real VS Code, both views at once), narrow and wide: every screen and every Customize tab swept at 170, 280, 420 and 700px wide in all three text sizes, no overflow
- [x] All 8 themes x every screen scanned for text under 4.5 to 1 contrast: none left (two real findings fixed: white on the red pockets, red text on the table)
- [x] Typecheck clean; 1,340 unit tests; integration 34/34 three times in production mode, once minified and once on the Vite dev path; the restart test; the VSIX installs and runs (15 files, 164 KB); idle CPU unchanged (resting about as VS Code alone; decorations off about 1%)
- [ ] Not done: a person listening to the sound packs, other operating systems, VS Code 1.90 itself (only the installed newer VS Code), Windows and Linux fonts for Medieval Fantasy cards

## Decisions worth knowing

* **Sounds are synthesized, not audio files.** Break Room Arcade has always made its sounds with the Web
  Audio API (small tone patches), so packs are more patches. That keeps everything local with no
  files to license and nothing to download, and fits the content security policy.
* **The coffee address** (`https://buymeacoffee.com/5x2bfo6t5c`) was real but the button is out of 0.2.2, see Phase 7.
* **No premium anything.** There is no field, flag or code path that could lock an option.
