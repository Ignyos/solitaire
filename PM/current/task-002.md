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
