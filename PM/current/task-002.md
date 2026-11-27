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
- The implementation remains local and uncommitted; it is not integrated into
  `dev`. A route-save failure now reverts to the saved route without repeating
  the failed write, and timer-checkpoint reversion restores the saved time.
- `build.ps1`, module syntax checks, `git diff --check`, and all nine browser
  deal and storage tests passed. Single-window browser checks covered reload,
  Resume, replacement, both Forfeit entry points, modal timer pauses, injected
  save failures and recovery, and offline reload. Recovery UI checks were manual.
- Playable cards, functional Undo and Replay, installed-PWA testing, and
  concurrent-window behavior were not covered. The remaining acceptance
  criteria are incomplete; this item stays in `current/`.
