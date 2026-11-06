# Lucky Break

Take a lucky break between builds. Two retro pixel-art games hidden in your editor: **Blackjack** and **Roulette**.

> **Virtual chips only. No real money, ever.** There are no payments, no purchases, no accounts and no
> way to win or lose anything but pretend chips.

## What you get

- **Blackjack** against the dealer, with every move you'd expect: hit, stand, double down and split.
- **Roulette** on a European wheel. Bet on a colour, or pick any of the 37 numbers, and watch the ball settle.
- **One wallet** for both games. You start with **1,000 chips**; it is kept between sessions.
- **Statistics and history** for the whole game and for each game: wins, losses, pushes, win rate,
  biggest win and loss, chips wagered, and your latest rounds.
- **Sidebar or editor tab.** Open Lucky Break in the Activity Bar, or in a larger editor tab. Both always
  show the same wallet, tables and settings, so you can use either (or both at once).
- **Make it yours, all free:** 8 themes, 6 playing-card designs, 5 roulette wheel animations, 5 sound
  packs and your own colors, from the **Style** tab. Changes apply at once and are remembered.
- **Retro sound effects** made on the fly, with an on/off switch, a volume slider and a switch for each kind of
  sound. Nothing plays when you open Lucky Break; sounds only follow something you did.
- **Settings for comfort:** a text size setting (normal, large, extra large), animations off, or reduced motion
  (it also follows your system's own setting).

## Getting started

1. Click the **Lucky Break** icon (a die) in the Activity Bar.
2. Pick **Blackjack** or **Roulette**, choose your chips, and play.

Commands (Command Palette, <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>):

| Command | What it does |
| --- | --- |
| **Lucky Break: Open Sidebar** | Shows Lucky Break in the Activity Bar. |
| **Lucky Break: Open in Editor** | Opens Lucky Break in an editor tab (a second call reuses the same tab). |

## The games

### Blackjack

- A single, freshly shuffled 52-card deck for every round.
- Beat the dealer without going over 21. The dealer must draw to 16 and **stands on every 17**.
- A natural blackjack pays **3 to 2**; a half chip is rounded down. Ordinary wins pay 1 to 1.
- **Double down** on any two-card hand: you double the bet and get exactly one more card.
- **Split** any two cards of the same value (so a king and a queen can be split, and so can a ten and a jack) into separate hands with the same bet each, up to four hands in all. A hand may be doubled after a split. Split aces receive one card each and stand, and a 21 after a split is an ordinary 21, not a blackjack.
- If you or the dealer is dealt a natural, the round is settled at once.
- There is no insurance and no surrender.

### Roulette

- A European wheel: 37 pockets, a single green zero.
- Bet on a **colour** or on a **single number**. Red and black pay **1 to 1**; green pays **35 to 1**; a number from 0 to 36 pays **35 to 1**. There are no other bets.
- The SPIN button stays at the bottom of the screen, so it is always in reach.
- Where the ball lands is decided the instant you press SPIN. The animation only reveals it.

### Chips and bets

- Chips come in 10, 25, 50, 100 and 500, and you can type any custom amount.
- The minimum bet is **10 chips**. You can bet your whole balance.

## Style

Open the **Style** tab (the palette) to make Lucky Break yours. Everything on it is free and nothing is
locked. A choice is saved and applied at once, with no restart.

| Tab | What you can change |
| --- | --- |
| Themes | 8 looks: Classic Felt, Neon Arcade, Retro 8-Bit, Midnight Felt, Crimson Felt, Cyber Felt, Forest Felt and Royal Felt. Each is shown as a small table before you choose it. |
| Cards | 6 playing-card designs: Classic Pixel, Retro 8-Bit, Neon, Medieval Fantasy, Minimal Pixel and Dark Deck, with all 52 cards and a back for each. |
| Wheel | 5 roulette animations: Classic, Arcade, Neon, Pixel Explosion and Slow Motion. **Try it** runs one on a sample wheel. In every style the ball stops on the number Lucky Break chose. |
| Sounds | 5 sound packs (Classic Lounge, Retro Arcade, Pixel Adventure, Neon Cyber, Minimal Sounds), a switch for each kind of sound (interface, chips, cards, roulette, results), the master switch and the volume. **Play sample** plays the pack you picked. All sounds are made on the spot, so nothing is downloaded. |
| Colors | Your own table, background, accent, main button, text and chip colors, six ready-made sets, a live preview and a reset to the theme's colors. Text always stays easy to read: a color that would make it hard to read is nudged, and the screen says so. |

## Settings

Open the **Settings** tab (the gear) inside Lucky Break.

| Setting | Effect |
| --- | --- |
| Sound effects | Turns every sound on or off. |
| Volume | 0 to 100. Slide it to hear the new level. **Test sound** plays a short sample. |
| Animations | Dealing, the dealer's reveal and the wheel. Off shows every result at once. |
| Reduced motion | Nothing moves, flashes or floats. Results still arrive one step at a time. Also on when your system asks for reduced motion. |
| Text size | Normal, large or extra large. Makes every letter in Lucky Break bigger. |
| Reset balance | Back to 1,000 chips. Statistics and history are kept. |
| Reset statistics | Clears statistics and history. Your chips are kept. |
| Reset all | Balance, statistics and history. Your settings are kept. |

Every reset asks you to confirm in a VS Code dialog first, and none can happen in the middle of a
blackjack hand. If you ever run out of chips, the game screens offer a shortcut to Settings, where you
can reset the balance.

## Easy on your computer

Lucky Break is meant to be left open in the sidebar while you work.

- Its background decorations (the floating embers, the blinking neon sign, the lobby pictures) are drawn
  five times a second while you use Lucky Break, and they **stop completely** about 15 seconds after you
  stop touching it. Moving the mouse over it, pressing a key or opening another screen wakes them again.
- When you are not looking, Lucky Break uses about as much processor time as VS Code does on its own.
  Switching **Animations** off, or **Reduced motion** on, removes the decorations altogether.
- The wheel and the cards still animate when you play, because that is the game.

## Your data and privacy

- Everything is stored **locally**, in VS Code's own extension storage on this machine. It is not
  synced, uploaded or shared.
- The extension makes **no network requests** and collects **no telemetry**. Lucky Break's pages are not
  allowed to load anything from the internet.
- The one thing that can leave your machine is the optional tip button on the Home screen, which asks VS Code
  to open a page in your browser (VS Code may ask you to confirm first). It does not give you any
  in-game chips: Lucky Break is virtual chips only.
- The game logic and the wallet run in the extension itself, not in the page you see, so the page cannot
  change your balance or peek at the dealer's hidden card.

## Good to know

- If you open VS Code in two windows, each keeps its own copy of the wallet, and the window that saves
  last wins. Play in one window at a time.
- A round of blackjack you leave unfinished when you close VS Code counts as lost; the bet was already
  taken from your chips.
- The editor tab is not reopened when VS Code restarts. Use **Lucky Break: Open in Editor** again.

## Requirements

VS Code 1.90 or newer. No other software is needed. The extension uses only VS Code's standard APIs and no operating-system specific code; it has been developed and tested on macOS.

## Support

If you enjoy Lucky Break you can leave an optional tip with the button on the Home screen and in the About card
of Settings. It opens a page in your browser. It is entirely optional: every theme, card design, animation,
sound pack and color is free, nothing is locked, and a tip gives no chips.

## Licence

Copyright (c) 2026 Edes Sulce. All rights reserved. You are welcome to install and use the extension, free of
charge. You may not copy, modify or redistribute it. The full text is in the `LICENSE` file included in the
extension.

## Credits

Pixel art, sound effects and code are original. The interface uses the open-source fonts **Press Start 2P**
and **VT323** (SIL Open Font License 1.1) and is built with React (MIT). See
`THIRD_PARTY_NOTICES.md`, included in the extension, for the full licences.
