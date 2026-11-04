# VS Code Casino

A retro pixel-art casino hidden in your editor. Play **Blackjack** and **Roulette** between builds.

> **Virtual chips only. No real money, ever.** There are no payments, no purchases, no accounts and no
> way to win or lose anything but pretend chips.

## What you get

- **Blackjack** against the dealer, with every move you'd expect: hit, stand, double down and split.
- **Roulette** on a European wheel. Bet on a colour and watch the ball settle.
- **One wallet** for both games. You start with **1,000 chips**; it is kept between sessions.
- **Statistics and history** for the whole casino and for each game: wins, losses, pushes, win rate,
  biggest win and loss, chips wagered, and your latest rounds.
- **Sidebar or editor tab.** Open the casino in the Activity Bar, or in a larger editor tab. Both always
  show the same wallet, tables and settings, so you can use either (or both at once).
- **Retro sound effects** made on the fly, with an on/off switch and a volume slider. Nothing plays when you
  open the casino; sounds only follow something you did.
- **Settings for comfort:** switch animations off, or turn on reduced motion (it also follows your
  system's own setting).

## Getting started

1. Click the **Casino** icon (a die) in the Activity Bar.
2. Pick **Blackjack** or **Roulette**, choose your chips, and play.

Commands (Command Palette, <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>):

| Command | What it does |
| --- | --- |
| **Casino: Open Sidebar** | Shows the casino in the Activity Bar. |
| **Casino: Open in Editor** | Opens the casino in an editor tab (a second call reuses the same tab). |

## The games

### Blackjack

- A single, freshly shuffled 52-card deck for every round.
- Beat the dealer without going over 21. The dealer must draw to 16 and **stands on every 17**.
- A natural blackjack pays **3 to 2**; a half chip is rounded down. Ordinary wins pay 1 to 1.
- **Double down** on any two-card hand: you double the bet and get exactly one more card.
- **Split** a pair into separate hands, up to four hands in all. Split aces receive one card each.
- If you or the dealer is dealt a natural, the round is settled at once.
- There is no insurance and no surrender.

### Roulette

- A European wheel: 37 pockets, a single green zero.
- You can only bet on a **colour**. Red and black pay **1 to 1**; green pays **35 to 1**.
- Where the ball lands is decided the instant you press SPIN. The animation only reveals it.

### Chips and bets

- Chips come in 10, 25, 50, 100 and 500, and you can type any custom amount.
- The minimum bet is **10 chips**. You can bet your whole balance.

## Settings

Open the **Settings** tab (the gear) inside the casino.

| Setting | Effect |
| --- | --- |
| Sound effects | Turns every sound on or off. |
| Volume | 0 to 100. Slide it to hear the new level. **Test sound** plays a short sample. |
| Animations | Dealing, the dealer's reveal and the wheel. Off shows every result at once. |
| Reduced motion | Nothing moves, flashes or floats. Results still arrive one step at a time. Also on when your system asks for reduced motion. |
| Reset balance | Back to 1,000 chips. Statistics and history are kept. |
| Reset statistics | Clears statistics and history. Your chips are kept. |
| Reset all | Balance, statistics and history. Your settings are kept. |

Every reset asks you to confirm in a VS Code dialog first, and none can happen in the middle of a
blackjack hand. If you ever run out of chips, the game screens offer a shortcut to Settings, where you
can reset the balance.

## Easy on your computer

The casino is meant to be left open in the sidebar while you work.

- Its background decorations (the floating embers, the blinking neon sign, the lobby pictures) are drawn
  five times a second while you use the casino, and they **stop completely** about 15 seconds after you
  stop touching it. Moving the mouse over it, pressing a key or opening another screen wakes them again.
- When you are not looking, the casino uses about as much processor time as VS Code does on its own.
  Switching **Animations** off, or **Reduced motion** on, removes the decorations altogether.
- The wheel and the cards still animate when you play, because that is the game.

## Your data and privacy

- Everything is stored **locally**, in VS Code's own extension storage on this machine. It is not
  synced, uploaded or shared.
- The extension makes **no network requests** and collects **no telemetry**. The casino's pages are not
  allowed to load anything from the internet.
- The one thing that can leave your machine is the optional **Buy me chips** button, which asks VS Code to
  open a support page in your browser (VS Code may ask you to confirm first). It does not give you any
  in-game chips: the casino is virtual chips only.
- The game logic and the wallet run in the extension itself, not in the page you see, so the page cannot
  change your balance or peek at the dealer's hidden card.

## Good to know

- If you open VS Code in two windows, each keeps its own copy of the wallet, and the window that saves
  last wins. Play in one window at a time.
- A round of blackjack you leave unfinished when you close VS Code counts as lost; the bet was already
  taken from your chips.
- The editor tab is not reopened when VS Code restarts. Use **Casino: Open in Editor** again.

## Requirements

VS Code 1.90 or newer. No other software is needed. The extension uses only VS Code's standard APIs and no operating-system specific code; it has been developed and tested on macOS.

## Support

If you enjoy the casino you can leave an optional tip with the **Buy me chips** button on the Home,
Statistics and Settings screens. Thank you!

## Credits

Pixel art, sound effects and code are original. The interface uses the open-source fonts **Press Start 2P**
and **VT323** (SIL Open Font License 1.1) and is built with React (MIT). See
`THIRD_PARTY_NOTICES.md`, included in the extension, for the full licences.
