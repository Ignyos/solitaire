# task-002: Build the first game, Klondike

## Scope

Design and build the application's first playable game, targeting Klondike,
using the approved application behavior in [REQUIREMENTS.md](../../REQUIREMENTS.md)
and the contracts in [ARCHITECTURE.md](../../ARCHITECTURE.md).
Develop the game implementation guide alongside it for future games.

## Acceptance criteria

- Users can navigate to a Klondike home page and play a Klondike deal.
- Gameplay, game options, persistence, undo, and navigation follow the approved
  application requirements and the agreed Klondike design.
- Users can open the reusable rules modal from the Klondike game-specific page.
- Klondike rules describe the implemented gameplay and available variants,
  and remain available offline.
- The game implementation guide captures what future games need to provide.

## Design and dependencies

- Agree on the remaining Klondike rules and options, initial release boundary,
  game presentation, and other open decisions in the requirements before
  implementing affected behavior. Draw-one and draw-three variants were
  requested for the initial rules content; exact details remain to be designed.
- Build the necessary shared services and resolve the implementation
  prerequisites described in the architecture as needed for this game.
- Reuse the rules modal and content introduced in task-001 (see the
  [PM index](../project-management.md)); reconcile the rules with the final
  implementation.
- Plan and confirm implementation in bounded slices rather than treating this
  backlog item as an approval of every unresolved design decision.

## Early integration for dev testing

- On 2026-11-27, the developer approved preparing early integration for dev
  testing while keeping this item in `current/`. A full real deal and physical
  devices remain unverified.

## Approved slice: multi-window coordination removal

- On 2026-11-27, the developer approved removing multi-window ownership,
  takeover, and stale-write protection. Concurrent windows may overwrite or
  corrupt saved progress; normal single-window durability remains required.
- The removal and related requirements/architecture changes are implemented
  in the local navigation work, but are not yet integrated into `dev`.
- `build.ps1`, module syntax checks, and five focused browser storage tests
  passed. A single-window browser check covered deal creation, timer activity,
  reload, and cancelled/confirmed Forfeit.
- Concurrent-window behavior was not verified. Card play and the rest of the
  task's acceptance criteria remain incomplete; this item stays in `current/`.

## Approved slice: saved-deal navigation

- On 2026-11-27, the developer approved the saved-deal/navigation slice:
  durable deal creation and restoration, Home and game menus, confirmed
  replacement and Forfeit, timer checkpoints, and save-error recovery.
- The implementation is committed on the task branch but not integrated into
  `dev`. A route-save failure reverts to the saved route without repeating
  the failed write, and timer-checkpoint reversion restores the saved time.
- `build.ps1`, module syntax checks, `git diff --check`, and all nine browser
  deal and storage tests passed. Single-window browser checks covered reload,
  Resume, replacement, both Forfeit entry points, modal timer pauses, injected
  save failures and recovery, and offline reload. Recovery UI checks were manual.
- Playable cards, functional Undo and Replay, installed-PWA testing, and
  concurrent-window behavior were not covered. The remaining acceptance
  criteria are incomplete; this item stays in `current/`.

## Approved slice: Retry

- On 2026-11-27, the developer approved renaming the deal-based Replay action
  to Retry and the initial Retry implementation. The picker shows finished
  deal results and attempt counts; Retry starts a new attempt with the same
  layout and options and confirms before replacing an unfinished attempt.
- `build.ps1`, syntax and whitespace checks, and seven browser storage tests
  passed. Browser checks covered both menu entry points, cancellation,
  replacement, restoration, modal timer pause, phone-width layout, and offline
  Retry. The Retry UI checks were manual.
- Playable cards, functional Undo, installed-PWA testing, and concurrent-window
  behavior were not covered. The implementation is on the task branch and not
  integrated into `dev`; the item remains in `current/`.

## Approved slice: game settings and new-deal options

- On 2026-11-27, the developer approved per-game Settings, immediately saved
  game options and display preference, and the reusable new-deal options dialog.
  An unfinished attempt is forfeited only when Forfeit & Start succeeds.
- `build.ps1`, syntax and whitespace checks, and nine browser storage tests
  passed. Browser checks covered both menus, the new-deal dialog paths,
  cancellation, timer pause, persisted options, save Retry/Revert, a 320px
  layout, and offline New Deal. UI checks were manual.
- Card play, functional Undo, installed-PWA testing, and concurrent-window
  behavior were not covered. The implementation is on the task branch and not
  integrated into `dev`; the item remains in `current/`.

## Approved slice: gameplay foundation

- On 2026-11-27, the developer approved the Klondike move and scoring engine
  and atomic storage of actions, unlimited Undo history, and winning outcomes.
- `build.ps1`, syntax and whitespace checks, eight browser deal/rules tests,
  and thirteen browser storage tests passed. Storage checks covered rollback,
  restored Undo, scoring penalties, timer checkpoints, over 100 Undo steps,
  and winning cleanup.
- Board controls, playable UI, offline gameplay, installed-PWA testing, and
  concurrent-window behavior were not covered. The slice is on the task branch; the
  item remains in `current/`.

## Approved slice: stock and Undo controls

- On 2026-11-27, the developer approved stock draws, waste recycling, the
  draw-three waste display, and durable Undo controls.
- `build.ps1`, syntax and whitespace checks, eight browser deal/rules tests,
  and thirteen browser storage tests passed. Browser checks covered draw-one,
  draw-three, recycling, reload and Undo, save Retry/Revert, and a 320px layout.
- Card movement and complete gameplay remain unfinished. Offline gameplay,
  installed-PWA testing, and concurrent-window behavior were not verified.
  The slice is on the task branch; the item remains in `current/`.

## Approved slice: card movement

- On 2026-11-27, the developer approved card dragging, desktop double-click,
  phone tap, keyboard destination selection, and the win transition.
- `build.ps1`, syntax and whitespace checks, nine browser deal/rules tests,
  and thirteen browser storage tests passed. Browser checks covered mouse and
  simulated touch drag, tap, double-click, keyboard moves, reload and Undo,
  save Retry/Revert, a winning position, and offline reload and Undo.
- A complete deal, physical touch devices, installed-PWA behavior, and
  concurrent-window behavior were not tested. The slice is on the task branch; the
  item remains in `current/`.

## Approved slice: card label styling

- On 2026-11-27, the developer approved correcting card label alignment and
  spacing in tableau stacks, dragged stacks, and the waste fan.
- `build.ps1`, syntax and whitespace checks, and ten browser tests passed.
  Browser checks measured label visibility and drag spacing and confirmed a
  real new deal starts with one face-up card in the first column.
- Physical devices were not checked. The slice is on the task branch; the item remains
  in `current/`.

## Approved slice: drag and move feedback

- On 2026-11-27, the developer approved reducing card padding, hiding the
  original dragged cards, and removing visual notices for illegal moves.
- `build.ps1`, syntax and whitespace checks, and eleven browser tests passed.
  Browser checks covered single-card and stack drags, legal and illegal drops,
  cancellation, lost pointer capture, and save-error recovery.
- Physical touch devices were not checked. The slice is on the task branch; the item
  remains in `current/`.

## Approved slice: save-progress text

- On 2026-11-27, the developer approved removing the temporary "Saving..."
  message while retaining save control locking and error recovery.
- `build.ps1`, syntax and whitespace checks passed. Browser checks covered
  delayed saves without modal resizing, saved settings, and failure/Revert.
- The slice is on the task branch; the item remains in `current/`.

## Approved slice: new-deal dialog styling

- On 2026-11-27, the developer approved emphasizing the forfeit warning and
  placing the smaller game-specific Settings explanation beside the checkbox.
- `build.ps1`, syntax and whitespace checks passed. Browser checks covered
  desktop and 320px layouts, checkbox saving, Cancel, and Forfeit & Start.
- Physical devices were not checked. The slice is on the task branch; the item remains
  in `current/`.

## Approved slice: real-deal checks and game guide

- On 2026-11-27, the developer approved bounded real-deal checks and the game
  implementation guide, including the distinction between the approved game
  contract and today's Klondike-specific integration.
- Draw-one and draw-three browser checks covered ordinary moves, saved reload
  and Undo; draw-three also covered stock recycling. `build.ps1`, whitespace,
  and guide-link checks passed.
- Neither deal was played to completion, and physical devices were not tested.
  The slice is on the task branch; the item remains in `current/`.
