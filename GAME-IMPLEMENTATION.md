# Game implementation guide

This guide helps contributors add a game consistently with
[REQUIREMENTS.md](REQUIREMENTS.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
Those documents own product behavior and the game contract. Agree on a game's
rules, options, interactions, and release scope before implementing them.

## Current integration boundary

Klondike is the first implementation and an example, not a generic plugin API.
The [registry](docs/games/registry.js) currently supplies gallery metadata,
rules, and option definitions; it does not export the full game contract in
the architecture. [main.js](docs/main.js) and
[Klondike navigation](docs/games/klondike/navigation.js) explicitly wire
Klondike, its routes, and its store. Adding a registry entry alone will not make
another game playable. Generalize the composition, routing, and game services
when the next game is designed; do not make shared modules import game modules.

## Registration, rules, and options

- Give the game a stable id, display name, description, rules content, and
  option definitions. See [registry.js](docs/games/registry.js) and
  [Klondike rules](docs/games/klondike/rules.js). Rules must describe the
  implemented variants and be accessible from the gallery and game menu,
  including offline.
- Classify each option as layout-changing or rule-only. Layout-changing
  options participate in the deal's stable layout key; rule-only options do
  not. The current Klondike registry does not encode this classification:
  draw count changes rules, not the starting layout, and Klondike uses the
  single layout key `standard`.
- Define defaults and valid choices. The shared
  [game settings](docs/core/game-settings.js) store holds each game's
  last-selected options and the New Deal dialog preference. Changes save
  immediately; each attempt also records the options it actually uses.
  Existing attempts and Retry keep their recorded options.

## Deals and identity

- Keep dealing and move rules independent of the DOM, storage, clock, and
  randomness. Supply the shuffled order and options as inputs. See
  [deal.js](docs/games/klondike/deal.js) and
  [moves.js](docs/games/klondike/moves.js).
- Preserve the canonical card order, deck composition, layout options, and
  dealing-definition version needed to reproduce a deal. Use a deal number
  scoped to a layout key, plus a fingerprint of the canonical order and
  definition version. A fingerprint is not a reversible deal index or a
  uniqueness guarantee. For multi-deck games, define consistent identities or
  canonicalize interchangeable cards.
- [deck.js](docs/cards/deck.js) provides a secure standard-deck shuffle and
  fingerprint helper. Check that they fit the new game's deck and identity
  rules before reuse; do not assume one standard deck works for every game.
  Klondike stores its deal, counter, fingerprint, and original cards in
  [store.js](docs/games/klondike/store.js).

## Navigation and attempts

- Provide a game home with a way to start a deal, review finished history, and
  Resume an unfinished attempt. Provide a game menu with the agreed actions,
  including New Deal, Retry, Forfeit, Settings, and Rules.
- Allow at most one unfinished attempt per game. Confirm before replacing or
  forfeiting it; cancelling must leave it intact. Record the outcome and
  relevant results when an attempt ends.
- Resume restores the saved position and Undo history. Retry starts a new
  attempt from the original deal and the selected finished attempt's recorded
  options, with empty Undo history. Do not silently substitute another deal.
- Persist stable navigation context, not open dialogs. Wait for pending saves
  before navigating, and handle missing or invalid saved data explicitly.
  Klondike's current history, route handling, timer, and menu are in
  [navigation.js](docs/games/klondike/navigation.js); they are not yet generic.

## Durable actions and storage

- Give the game its own IndexedDB object store and versioned upgrade logic.
  [storage.js](docs/core/storage.js) provides transaction and request helpers.
  Klondike registers its store when navigation opens the database; a new store
  also needs a database version upgrade for existing installations.
- Save each user action, all automatic consequences, the resulting snapshot,
  and its Undo entry atomically. Undo atomically restores the previous state
  and removes the entry. Do not impose a fixed Undo count limit; history lasts
  until the attempt is won or forfeited.
- Record a win or Forfeit and remove its Undo history in the same transaction.
  Coordinate timer checkpoints, if used, with action saves. Do not await
  unrelated asynchronous work inside an IndexedDB transaction.
- Use the existing save coordination pattern: retry transient failures, then
  block further writes and offer Retry or Revert. Surface errors to the user
  and log technical details. Concurrent windows are not coordinated.

## Interaction, assets, and verification

- Implement drag-and-drop and desktop double-click; define deterministic
  automatic-move priorities for the game. Consider single-tap phone moves.
  Foundation-first and leftmost-tableau priorities are Klondike choices, not
  universal rules. Support keyboard use, responsive layouts, and accessible
  labels. Define stock recycling separately for each game.
- If the game has scoring, move counts, or a timer, decide its rules explicitly.
  Klondike counts one user action including automatic consequences, applies a
  one-point Undo penalty, and measures active play; these are preferences, not
  mandatory scoring or timing rules for other games.
- Add every deployed module and asset to
  [service-worker.js](docs/service-worker.js); use release-stamped imports
  and the existing publishing tools rather than changing stamps manually.
  Consult the shared-code catalog in [ARCHITECTURE.md](ARCHITECTURE.md) before
  adding helpers, and update it when shared exports change.
- Add focused deal/rule and durable-storage tests alongside the existing
  [deal tests](tests/deal.test.js) and
  [storage tests](tests/durable.test.js). Check ordinary play, all variants,
  invalid actions, save failure/recovery, Undo after reload, navigation,
  Retry/Forfeit, rules, and offline behavior. Follow the local validation and
  browser-test instructions in [README.md](README.md).
