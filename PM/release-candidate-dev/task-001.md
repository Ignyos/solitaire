# task-001: Per-game rules access

## Scope

Provide users with access to Klondike rules from the application home and
make the approach suitable for additional solitaire games.

## Acceptance criteria

- Users can open Klondike rules from its game card without leaving Home.
- Rules content and the modal can be reused for additional games.
- The rules can be accessed offline after the app assets have been cached.

## Design decisions

- Rules are accessed from a per-game card menu, not the application menu.
- Rules are presented in a reusable modal without changing navigation.
- The same rules content and modal can be reused on a game-specific page.
- Klondike documents classic draw-one and draw-three variants.

## Implementation slice

- Add a reusable game registry and per-game rules contract.
- Add Klondike rules with setup, objective, moves, and planned variants.
- Expose them through the Klondike game card menu in a reusable modal.
- Include all rules assets in the offline cache.

## Status

The earlier rules-page slice and the subsequent modal and menu revision were
accepted by the developer on 2026-11-25.
The module-stamping and offline-verification slice was also accepted on
2026-11-25.

The developer approved closing this implementation scope on 2026-11-25.
The item remains a dev release candidate; it has not been published.
Rules access from the game-specific page and alignment with implemented
gameplay are carried forward in task-002 (see the
[PM index](../project-management.md)).

## Verification

- `build.ps1` passed.
- `git diff --check` passed.
- Local HTTP smoke checks returned 200 for the index, main module, game registry,
  and Klondike rules module.
- The rules content documents classic draw-one and draw-three Klondike behavior,
  while explicitly noting that gameplay is not yet implemented.
- The modal revision was checked in a browser for menu selection, unchanged URL,
  close button, Escape, outside-click dismissal, focus restoration, small-screen
  layout, and reuse with another game's supplied content.
- A disposable copy was stamped with a new release version and passed
  `build.ps1`. The stamped app loaded, then reopened the rules modal after
  its local server was stopped and the page reloaded.
- No live dev publish or production release was run.
