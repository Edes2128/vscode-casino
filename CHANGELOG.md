# Changelog

## 0.2.0

- **Blackjack split fixed:** any two cards of the same value can be split (a king and a queen, a ten and a
  jack), not only two of the same rank. The rules are checked against an independent reference rulebook over
  100,000 random rounds, both for the engine and for the wallet that pays it.
- **Roulette number bets:** bet on any single number from 0 to 36 (35 to 1) as well as on a colour. A number
  grid shows all 37 in their wheel colors, and the SPIN button stays pinned to the bottom of the screen. The
  DEAL, HIT, STAND, DOUBLE and SPLIT buttons of Blackjack are pinned the same way.
- **Easier to read:** brighter secondary text, larger type, rank and suit printed in the corners of every card
  so overlapping cards stay readable, and a new **Text size** setting (normal, large, extra large).
- **Customize screen (the Style tab), all free:** 8 casino themes, 6 playing-card designs, 5 roulette
  animations (the ball always stops on the number the casino chose), 5 sound packs with a switch for each
  kind of sound, and custom colors with presets, a color picker, a live preview and a reset. Text stays readable
  whatever colors are picked.
- **Buy me a coffee:** an optional, quiet button on the Home screen and in the About card of Settings.
- Saved settings from 0.1.0 keep working; every new option falls back to its default if it is missing.

## 0.1.0

First release.

- Blackjack: a single shuffled deck per round, blackjack pays 3:2, the dealer stands on every 17,
  double down on any two cards, split pairs up to four hands.
- Roulette: European single-zero wheel, bets on colour only. Red and black pay 1:1, green pays 35:1.
- One shared wallet of virtual chips (1,000 to start), kept between sessions, with statistics and
  game history.
- Pixel-art interface in the sidebar and in an editor tab, always showing the same casino.
- Settings: sound effects and volume, animations, reduced motion, and resets for the balance, the
  statistics or everything, each after a confirmation.
