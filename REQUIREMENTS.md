# Solitaire application requirements

## Document status

Initial baseline from owner direction supplied on 2026-10-12. This document
owns application requirements; the PM index owns work status. Sections marked
**Open** are unresolved, not permission to choose a behavior or technology.
This baseline does not authorize implementation or define a complete first release.

## 1. Purpose and product principles

- Provide Solitaire card games for casual use.
- Never display advertisements.
- Offer more than one Solitaire game, with support for introducing additional
  games in the future.
- Store application and gameplay data locally in the browser.
- Assume one user per browser data store; multi-user accounts, profiles, and
  tenant separation are not part of the requested model.

Klondike is the only confirmed initial game. Additional games, such as Spider,
follow later using the game implementation guide (section 3a).

## 2. Application home and navigation

### Application home

- The application home/splash page presents a card gallery of available games.
- Selecting a gallery entry navigates to that game's own home/landing page.
- Switching between game types, such as Klondike and Spider, is done through
  the application home.
- Preserve the intended existing `docs/index.html` content from its `<h1>`
  element upward, including the current branding and heading.
- Replace the existing content below that heading with the game gallery.
  Gallery card appearance and responsive layout remain to be designed.
- Starting another deal of the same game is done from that game's home page,
  rather than by using the application-level gallery to start a deal directly.

### Persistent menu

A menu control is always present at the top left of the viewport, regardless
of application state or current page/game.

| Option | Required behavior |
|---|---|
| Install App (Help) | Provides PWA installation/offline-use assistance. |
| Home | Returns to the application home/splash page; retains game progress already saved after every move/choice. |
| Settings | Opens application settings; available options are TBD. |
| About | Opens a simple modal with creator attribution linked to Ignyos, application version, and release notes. |

The owner supplied https://kap.ignyos.com/ as an example for installation help.
This is a design reference, not a requirement to copy its implementation.
Attribution URL and release-notes presentation remain open. Open menus close
when the user clicks outside them, leaving focus on the clicked target; Escape
closes an open menu and returns focus to its trigger. Modals close on Escape
or when the user clicks outside the modal.

## 3. Game-specific home pages

Every offered game has its own home/landing page with:

- A way to start a new deal.
- Options specific to that game.
- History of previously played deals, including:
  - The deal/shuffle index.
  - Whether an attempt was won or forfeited.
  - The selected options under which that attempt was played.
  - An option to retry a finished deal, regardless of its outcome.
  - An option to resume an unfinished deal.

The history must distinguish unfinished attempts from finished attempts.
History ordering and changing options while a deal is in progress are open.

### Ending an attempt

- Forfeit is currently the only way to end an attempt without winning. A
  separate automatic "lost" outcome is not planned; revisit per game when
  designing individual game layouts.
- Each game has an in-game menu for game-specific actions such as Forfeit. It
  uses a consistent location and appearance across games. Its placement relative
  to the persistent application menu is designed with the game layouts.

### Deal identity

- Define reproducible deal identifiers per game; there is no expected universal
  index standard across games. Deck sizes and dealing methods may differ.
- Retrying a deal recreates its original starting layout.
- Layout-changing options (those affecting deck composition or the initial
  layout) are chosen only before a new deal. They are locked during Retry.
- Retry uses the same options as the attempt being retried.
- History records the options selected for each attempt.
- A deal is identified by a composite key of the game's deal index plus its
  layout-changing options, which together fully determine the starting layout.
- Rule-only options are not part of the deal key; each attempt record stores
  them.
- Each game type has its own IndexedDB object store, allowing game-specific
  record shapes. Adding a game therefore adds a store through a versioned
  database upgrade.
- Deal identity is based on card order as detailed below.
- Sharing deal indices across browsers/users is out of scope; do not design a
  deal-sharing/import feature. Local history and retry still require deal identity.

Retries reuse the deal's canonical data while creating distinct attempt records
with their own selected options and progress.

Card order reproduces a layout only when deck composition and the dealing
algorithm are also known. For multi-deck games, use consistent card identities
or canonicalize interchangeable duplicates. A hash is a compact fingerprint,
not a reversible shuffle index or an absolute uniqueness guarantee.

Every game must classify each option as layout-changing or rule-only. Retry
must preserve the original layout; layout-changing options are locked to
their original values for that reason.

**Deal index (approved direction):**

- **Shuffle:** generate each new deal with an unbiased Fisher–Yates shuffle
  driven by `crypto.getRandomValues`.
- **Canonical deal data:** the deal record stores the shuffled card order
  itself, plus the dealing-definition version and layout-changing options.
  Card order is the source of truth, so a deal never depends on reproducing a
  random-number algorithm, and changing the shuffle code later cannot alter
  saved deals.
- **Deal number:** each deal gets a sequential local number, numbered separately
  per game and per layout-changing option combination (for example Spider
  1-suit #12 and Spider 4-suit #12 are different deals). The composite key is
  `[layoutKey, dealNumber]`, where `layoutKey` is a stable canonical string of
  the layout-changing options. The UI shows the deal number, for example
  "Deal #12".
- **Fingerprint:** also store a SHA-256 hash of the canonical card order and
  dealing-definition version. It is an index for detecting an accidental
  duplicate deal and verifying integrity, not the user-facing identifier.
- **Duplicates:** with 52! possible orders a duplicate is practically
  impossible, so the application does not attempt to avoid one; the
  fingerprint only detects it.
- **Rejected alternatives:**
  - A random seed as the index is compact, but it ties every saved deal to one
    random-number generator and shuffle algorithm forever.
  - A reversible permutation index, such as a 226-bit Lehmer code for 52 cards,
    is too long to display and adds nothing without sharing.
  - A hash alone is not reversible and not friendly to read.

Sharing an index would mean another installation/browser could enter or import
it to reproduce the deal. Local Retry does not require that feature.

## 3a. Game implementation guide

Klondike is implemented first. Alongside it, produce an implementation guide so
later games are added consistently. The guide covers at least:

- Game registration in the application gallery.
- The game home page, history, and Retry/Resume.
- Option classification (layout-changing versus rule-only) and settings layers.
- Deal generation, deal index, and the game's IndexedDB store design.
- The in-game menu and Forfeit.
- Undo steps and the save-per-action contract.

The guide's location and format are decided with the Klondike work. Code
structure, import rules, the game contract, and the shared-code catalog are
owned by `ARCHITECTURE.md`; the folder structure there is provisional until
Klondike confirms it.

## 3b. Settings layers

| Layer | Scope | Examples | Storage |
|---|---|---|---|
| 1. Application | Whole application | Theme, notification location, animation, duration, announcements | Shared settings store |
| 2. Game type | One game type, all deals | Last-selected options for that game's next new deal | Shared settings store |
| 3. Deal | One deal of one game | The options under which Deal #12 is played | Stored with the deal in the game's own store |

- One shared settings store holds all application settings and every game
  type's settings.
- Each game has its own store and owns its store design.
- The exact storage record layout is a separate future discussion.
- A new deal preselects the game's saved type-wide settings (last-selected
  options). The actual options used are also stored with the deal.
- Changing an option on a game's home page immediately updates that game's
  last-selected settings, even if the player leaves without starting a deal.

## 4. Gameplay, interaction, and undo

- Drag-and-drop is a required way to move cards on the board. Tap/click
  selection followed by choosing a destination is not a substitute for it.
- Double-clicking a card is supported. When a move is available for that card,
  the game applies an available move; each game's rules define the decision
  logic for choosing which move.
- Every game supports undo for 100% of the user's actions in an attempt; do not
  impose a smaller fixed undo-history limit.
- An undo step is any individual action taken by the user.
- The attempt's move history is stored durably in the game's own store, with
  the attempt. Leaving a game, going Home, closing the application, reloading,
  or updating does not discard it; Resume restores full Undo.
- A session ends when the user wins or forfeits the attempt. Undo is then no
  longer available for that attempt.
- Retry starts a new attempt with an empty move history.

- Automatic consequences of a user action, such as an automatic card flip, are
  undone together with that action as one step.
- When an attempt is won or forfeited, its stored move history is deleted in
  the same transaction that records the outcome. Replay is not planned.

- Redo is explicitly out of scope and is not expected to be introduced.

## 5. Persistence and restoration

- IndexedDB is the durable data store for application state, game progress,
  move/undo history, game history, settings, and other stored application data.
- Save game state after every move/choice, including the resulting state after
  Undo. Home, pause, and leaving the game do not require an independent progress
  save operation.
- Do not impose an application-defined limit on unfinished deals per game.
  Browser storage capacity still applies; unlimited storage is not promised.
- When a user closes the application mid-game or at another point and returns,
  restore where they left off seamlessly.
- Restoration includes the saved gameplay position and application context,
  not merely a fresh deal or a forced return to the application home.
- Resuming a persisted attempt restores its undo history.

Application context means the place and UI state to restore: application Home,
a particular game's home, or a particular attempt's gameplay view. It is
distinct from the cards/piles that constitute game progress. Restore the last
stable view, not transient About/Help/Settings dialogs. Closing during gameplay
returns to the saved board; closing on a game's home returns to that home.
History scroll position and unfinished option selections remain open.

### Approved persistence behavior

- Persist a complete current snapshot per attempt: piles, card order/orientation,
  game-specific state, selected options, outcome, and revision. Restoration
  loads this snapshot directly rather than replaying the move history; the move
  history serves Undo.
- Save each move, its automatic consequences, and its move-history entry
  atomically. Undo removes the last entry and saves the resulting snapshot in
  the same transaction. Navigation waits for a pending write rather than
  racing it.
- Surface failed saves explicitly instead of silently losing progress.
- Restore stable navigation context without reopening transient dialogs.

**Remaining proposals, not approved:**

- Store deals separately from attempts. A deal owns its original layout; an
  attempt owns selected options, outcome, timestamps, current card/pile state,
  game-specific state, and a monotonically increasing revision.
- Persist attempt snapshots and related history outcomes together so they
  cannot disagree after an interrupted write.
- Store stable navigation context separately using route, game id, and attempt
  id where relevant; its exact storage structure is not decided.
- Query/page history rather than loading every unfinished attempt into memory.

**Open:** define the exact durable record schema. Per-action snapshots, atomic
transitions, and waiting for writes before navigation are approved; field names
and implementation details are not.

**Save-error recovery:** a save can fail, for example because storage quota is
full, the browser denied storage in a private window, or the database was closed
by an upgrade or the browser. The board then shows a move that is not durably
stored.

- Retry the failed save automatically up to three times, one second apart.
- If it still fails, block further moves and show an Error notification that
  stays until handled, offering Retry and Revert to last save.
- Keep the unsaved move in memory so a successful Retry saves it. Revert to last
  save discards it and reloads the last durable snapshot.

Revision mismatches are handled separately from storage failures. Stop further
moves, show a friendly message that progress changed elsewhere, and offer to
load the latest saved snapshot; this discards the unsaved action. Do not retry
or replay the stale action automatically.

### Concurrent tabs/windows

Two tabs or an installed PWA window and browser tab can share one origin's
IndexedDB. Without coordination, stale snapshots can overwrite newer progress,
settings, outcomes, or the last-view record even for a single user.

Only one application window per origin may write at a time. Other tabs/windows
show an explicit already-open/read-only notice. Coordinate ownership and use
transactional revision checks to prevent stale overwrites.

When a database upgrade is requested, every open window closes its connection
on `versionchange` and stops storage activity. The requesting window waits for
old connections to close before upgrading. Displaced windows show a friendly
update-and-reload notice rather than continuing with a closed connection.

Use an exclusive Web Lock where supported, with a tested fail-closed fallback
for supported browsers. Use revision checks inside IndexedDB transactions as an
additional stale-write guard, and BroadcastChannel for state/ownership
notifications, not as the lock. Reload current state, including move history,
when ownership is acquired; never carry a stale in-memory undo stack into a
newly acquired session. Never take ownership from an active window without the
user's explicit action.

**Ownership recovery:** how a read-only window becomes the writable one.

- When the writable window closes normally, a waiting window takes over
  automatically and reloads the latest saved state.
- When the writable window crashes or is killed, the browser releases its lock
  during cleanup and a waiting window takes over the same way. A frozen or
  sleeping window may hold ownership indefinitely.
- A read-only window offers "Use here instead". Choosing it demotes the other
  window to read-only; this window reloads the latest saved state and continues.

Browser storage eviction/clearing may remove saved data; do not promise
recovery from browser-deleted data or rely solely on a close event to implement
persistence.

If IndexedDB is unavailable or a required migration fails, block gameplay and
settings writes with a friendly message; static Help/About content may remain
available. Do not permit volatile-only gameplay.

## 6. PWA and offline use

- The application can be installed as a PWA for offline use where the browser
  and platform support installation.
- The persistent Install App (Help) option explains installation and offline use.
- Saved state and game access must support the intended offline experience.

### Approved offline and update behavior

- Cache the application shell and all games/assets shipped in the current
  version, including local help.
- Require an initial successful online load and complete cache preparation.
  Show offline readiness only when every required same-origin asset in the
  current release manifest is present in Cache Storage. Recheck on app startup
  and when Install App (Help) opens; do not trust a stored readiness flag.
  Installation alone is not proof of readiness. Later browser eviction can
  remove cached assets.
- Make offline play, local history, retry, settings, and resume available in
  both browser and installed modes; installation is optional for offline play.
- Offer the native install prompt where supported, iOS/iPadOS Safari Add to
  Home Screen guidance, and instructions for browsers without native prompts.
  Do not promise an install button on every platform.
- Download updates quietly in the background. Do not show update-available
  notifications, request approval, or force a reload. Keep the running version
  active until its application windows close; the new version activates after
  that and applies on the next launch.
- Apply database/game-state migrations on startup before restoring the saved
  context. Migration failures must be handled without deleting existing records
  and reported with a friendly message. Version stored schemas and game-state
  formats.

The owner approved caching all shipped games/assets including help, an initial
online load/cache preparation, offline play without installation, browser-specific
install help, silent deferred updates, and versioned data formats with
non-destructive migration failure handling. The browser performs service-worker
checks when it runs the app; a closed app does not guarantee an immediate
background download. (The earlier user-approved reload and undo-loss warnings
were superseded.)
Local release-note caching and exact migration mechanics are not specified.
Runtime CDN assets are excluded by the approved coding rules.

**Open:** define browser/platform help selection and manual fallback.
Specialized migration recovery workflows are deferred unless actual needs arise.

### Installation assistance: capability-first approach

Prefer observed browser capabilities and installation state over claiming to
identify a device/browser perfectly.

- Service worker and Cache Storage support indicate available offline mechanisms,
  not that all required assets have finished caching. Track cache completion and
  verify required assets before claiming offline readiness.
- `beforeinstallprompt`, where available, provides a browser-offered install
  action; it is not universal, and its absence does not prove lack of support.
- `appinstalled`, where available, reports installation during that session;
  it is not a universal installed-app inventory.
- `matchMedia('(display-mode: standalone)')` identifies a matching current launch
  mode, not whether an installation exists elsewhere. Other display modes may
  also apply; Safari's non-standard `navigator.standalone` can supplement this.
- Use `navigator.userAgentData` where available or conservative user-agent
  hints only to suggest instructions. These signals are incomplete and can be
  spoofed; iPadOS desktop-style reporting and embedded browsers need fallbacks.
- Let the user select their browser/platform instructions manually. Do not
  equate touch support, screen size, or pointer media queries with a specific OS.

Do not use a detection library or device fingerprinting. Responsive layout
uses viewport/input capabilities independently of install-help hints.

Install App (Help) persistently shows Preparing offline access, Ready offline,
or Not Ready. Background cache preparation/repair does not notify the user when
a failure does not affect the current flow. If a missing resource blocks or
degrades the feature currently in use, show a friendly notification/error with
retry guidance. Attempt preparation on first load; after an incomplete attempt,
retry quietly when connectivity returns or Install App (Help) opens, at most
once per trigger. Do not poll or create rapid retry loops.

Install App (Help) also shows a persistent offline-readiness status, since
notifications disappear and the user may need to check status later.

The current scaffold's immediate service-worker activation conflicts with the
approved silent, deferred update policy; it must be changed before that policy
is implemented.

## 6a. Notification system

A reusable notification system communicates application messages, including
errors that affect the current user flow. Offline-readiness status is persistent
in Install App (Help); unrelated background cache failures do not interrupt.

- Notifications display as cards at a page location that a future Settings
  option will make configurable.
- Multiple notifications stack.
- Each card's color indicates its type:

  | Type | Color |
  |---|---|
  | Error | Red |
  | Warning | Orange |
  | Information | Blue |
  | Success | Green |

- Each card pairs its color with an icon or text label so type is not conveyed
  by color alone.
- Cards enter and leave with an animation chosen in a future Settings option:
  Slide In/Out (from the page edge), Fade In/Out, or No Animation.
- Cards disappear automatically after a number of seconds that a future
  Settings option will make configurable.
- Auto-dismissal pauses while a card is hovered or focused.
- Errors that require action, such as a failed save, stay until the user
  dismisses or resolves them rather than auto-dismissing.
- Each card has a close "X" in its upper-right corner for early dismissal; the
  control has an accessible name.
- Notifications are announced to screen readers (assertive for errors, polite
  otherwise). A future Settings option enables or disables announcements.
- Cards never cover the persistent application menu.

Defaults:

| Setting | Default |
|---|---|
| Location | Upper right, stacked directly below the persistent menu |
| Animation | Fade In/Out |
| Auto-dismiss duration | 3 seconds |
| Screen-reader announcements | Off |
| Maximum stack height | 3 cards |

- When the operating system reports a reduced-motion preference, the default
  animation is Fade In/Out until the user chooses another option. This matches
  the general default.

- When a fourth card arrives, dismiss the oldest non-error card. If all three
  visible cards are errors, queue the new card until a slot opens.
- When announcements are off, no notifications are announced, including
  action-required errors.

## 7. Responsive presentation and interaction

- CSS/layout must support desktop, tablet, and mobile-phone viewports.
- Navigation, game-specific home pages, history, modals, and gameplay must remain
  usable across those viewport classes.
- Keep the persistent menu accessible at the top left across supported layouts.
- Every interactive control outside the card board (menus, game homes, history,
  settings, modals, notifications) can be reached with Tab and operated with
  the keyboard, with visible focus. Keyboard play of the card board itself is
  part of the open presentation discussion below.
- The visual design supports multiple themes. One default theme ships first;
  additional themes and a theme choice in Settings may follow.
- Error messages shown to the user are short and friendly. Full technical
  details go to the browser console.

**Open:** define supported viewport sizes, portrait/landscape behavior, card
readability, tableau overflow/scrolling, drag-and-drop details, and keyboard
and assistive-technology requirements.

The desired presentation includes substantial card movement animation, such as
cards moving between board locations while pile ordering changes. Evaluate
whether each rendering approach can deliver the desired transitions before
choosing one. No renderer or animation architecture is selected.

**Discussion topics, not approved:**

- Evaluate phone portrait/landscape, tablet portrait/landscape, and desktop.
  Candidate test widths: 320, 375, 768, 1024, and 1440 CSS pixels, with explicit
  short-height landscape tests. These are proposed targets, not agreed limits.
- Reflow surrounding controls; use game-specific pile spacing and overlap
  rather than shrinking the whole board until cards become unreadable.
- Preserve readable rank/suit indicators; use controlled board scrolling when
  a game's minimum readable layout cannot fit. Decide per game whether vertical,
  horizontal, or no scrolling is appropriate, with the menu kept reachable.
- Target at least 44 by 44 CSS pixels for primary controls. Overlapping cards
  need separate hit-area/selection design rather than claiming every exposed
  card fragment meets that size.
- Discuss full keyboard play, visible focus, meaningful card/pile labels,
  announcements for moves/errors, non-color-only suit cues, and reduced motion
  before choosing the renderer. Do not disable browser zoom to make a layout fit.

### Rendering architecture decision

No rendering approach has been selected. Evaluate:

1. HTML/DOM elements for individual playing cards.
2. A canvas-based game surface.
3. A library-assisted approach, such as Phaser.

The existing toolkit profile is a vanilla JavaScript foundation. The owner has
since confirmed native ES modules and no Node tooling; a runtime library such
as Phaser would still need explicit approval. Any dependency or architecture
change needs an explicit decision rather than being introduced during
requirements capture.

Compare the approaches against responsive layout, accessibility, input methods,
card animation/interaction needs, offline payload, complexity, and maintenance
as more games are added. Choose measurable requirements before selecting a renderer.

The owner explicitly keeps presentation/rendering decisions open while the
other clarified topics are resolved. DOM, canvas, Phaser, viewport targets, and
interaction/accessibility proposals are not approved by the persistence/PWA decisions.

## 8. Initial-release boundaries and open decisions

### Scope of the current requirements-design task

This task establishes the approved application-wide and shared-core behavior,
service boundaries, clean-code rules, and provisional architecture documented
above and in `ARCHITECTURE.md`. It does not approve a complete first-release
feature set, detailed game rules, a renderer, or gameplay implementation.

### Deferred for follow-up design

These decisions remain open and must be resolved in the relevant follow-up
design before implementing the affected feature. Their deferral is not approval
or rejection of any option.

- Klondike's exact variant, rules, and options; the initial release boundary;
  and the game implementation guide details.
- Detailed IndexedDB record fields, indexes, and exact repository API
  signatures (reserved for a separate storage-schema discussion).
- Presentation: renderer and animation architecture, viewport/portrait-landscape
  targets, card readability and scrolling, drag-and-drop details, and gameplay
  accessibility.
- In-game menu placement and appearance.
- Exact installation-help instructions and platform-specific wording.
- About attribution URL and release-notes presentation.

Hints, scoring, timers, statistics, sound, accounts, and cloud sync are
not specified by these notes. Their absence here is not a decision to add them
or a permanent decision to prohibit them.
Redo and deal sharing are explicitly excluded.

## 9. Baseline acceptance scenarios

These scenarios express confirmed direction. They are not a complete test plan;
the open decisions above must supply exact rules and measurable thresholds.

| Area | Expected result |
|---|---|
| Casual/ad-free use | No page, menu, or gameplay state displays advertisements. |
| Game navigation | Gallery selection opens the selected game's home; switching game types is possible through application Home. |
| Branding | The existing heading and content above it are retained; the old below-heading starter content is replaced by a game gallery. |
| New deal | A user can start another deal from that game's home page. |
| Persistent menu | The top-left menu control is present on application Home, game homes, and during gameplay. |
| Home during play | Returning Home retains progress saved per move/choice; its game history offers Resume. |
| Finished history | A finished attempt shows its deal index, selected options, and won/forfeited outcome and offers Retry. |
| Retry options | Retry recreates the original layout with the same options as the retried attempt; each attempt retains its own recorded options. |
| Board interaction | Cards can be moved by drag-and-drop. Double-clicking a card performs an available move according to that game's rules. |
| Notifications | Messages appear as stacked cards with type color plus icon/label, animate per the animation setting, pause while hovered/focused, auto-dismiss after the configured time (except action-required errors), never cover the menu, and can be closed early with an X. |
| Session undo | Every individual user action in the attempt can be undone until the attempt is won or forfeited. |
| Undo persistence | Leaving a game, closing, reloading, or updating, then resuming, still allows undoing every prior action of the attempt. |
| Restoration | Closing and reopening restores the last persisted application/game state, including undo history. |
| Local storage | Durable state, including move history, is in IndexedDB. |
| Per-action save | Each move/choice, including Undo, saves resulting durable game state. |
| Unfinished deals | No fixed application count cap prevents keeping another unfinished attempt. |
| Redo | No redo feature is offered. |
| Install assistance | Install App (Help) explains supported installation and offline-use behavior. |
| Offline readiness | Install App (Help) persistently shows whether the current version's required assets are cached and ready for offline use. |
| Quiet cache recovery | An unrelated background cache failure leaves the persistent Help status Not Ready without an interruption; only a failure affecting the current feature produces a notification/error. |
| About | About opens a modal with linked Ignyos attribution, version, and release notes. |
| Responsive use | Once viewport targets are agreed, navigation and gameplay preserve readable content and reachable controls across those targets. |

## 10. Direction record

- 2026-10-12: Owner supplied this initial requirements baseline and requested
  documentation before further application design or implementation.
- 2026-10-12: Owner deferred the initial roster decision until the presentation
  and data-layer approach is established.
- 2026-10-12: Owner clarified per-game reproducible layouts, retry with newly
  chosen options, per-attempt option history, no redo, saving every move/choice,
  and no requested unfinished-deal cap. Presentation, data-schema, concurrency,
  and offline/update recommendations remain proposals awaiting discussion.
- 2026-10-12: Owner approved distinguishing layout-affecting options, no deal
  sharing, stable-view restoration without transient dialogs, complete attempt
  snapshots with atomic move/automatic-action saves, waiting for writes on
  navigation, visible save failures, and one writable application window.
  Owner also approved the offline/update behaviors listed in section 6.
  Offline-status placement and reliable installation guidance detection remain
  discussion topics. Presentation/rendering remains explicitly open.
- 2026-10-14: Owner decided layout-changing options are available only before a
  deal and locked during Retry; Retry pre-selects the prior options; deals use
  a composite key of index plus selected options; each game type has its own
  IndexedDB store. Owner specified the reusable notification system in section
  6a for offline status and other messages. Owner asked for explanations of
  ownership recovery and save-error recovery, now described as open items.
- 2026-10-14: Owner approved notification proposals: icon/label with color,
  screen-reader announcements (future enable/disable setting), pause on
  hover/focus, animation setting (Slide, Fade, None), action-required errors
  persist, and cards never cover the menu. Owner removed the "retry with easier
  settings" story: Retry uses the same options. Owner approved keying deals on
  index plus layout-changing options, with rule-only options stored per attempt.
- 2026-10-14: Owner set notification defaults (upper right, Fade In/Out,
  3 seconds, announcements off, max 3 stacked) and Fade In/Out under
  reduced motion. Owner approved the save-error recovery and ownership recovery
  behavior. Owner requested a deal-index proposal; presentation remains TBD.
- 2026-10-14: Owner approved notification overflow (dismiss oldest non-error;
  queue when all visible are errors), declined announcing errors when
  announcements are off, and set automatic save retries to three, one second
  apart.
- 2026-10-14: Owner approved the deal-index direction. Owner defined one shared
  settings store plus a store per game, three settings layers, Forfeit as the
  only non-win ending for now with a consistent per-game menu, an undo step as
  any individual user action, and a session ending on win or forfeit. Klondike
  is the only initial game, developed alongside a game implementation guide.
  Presentation remains TBD.
- 2026-10-14: Owner changed undo: move history is stored durably with the
  attempt in the game's store, replacing the earlier session-only undo. This
  supersedes "leaving a game discards undo" and the update undo-loss warning.
- 2026-10-14: Owner approved undoing automatic consequences with their causing
  action as one step, and deleting move history when an attempt is won or
  forfeited (no replay mode). Presentation, Klondike rules/options, in-game
  menu design, and storage layout remain TBD.
- 2026-10-14: Owner approved clean-code rules in `.github/instructions/`
  (JavaScript, CSS, HTML), native ES modules with release-stamped import paths,
  no Node tooling, an in-repo browser test runner in `tests/`, themes via CSS
  custom properties, keyboard/Tab navigation, friendly UI errors with full
  console details, and a shared-code catalog to prevent redundancy. Owner
  approved the import rules, game contract, and shared-code promotion rule; the
  folder structure stays provisional until Klondike confirms it. These live in
  `ARCHITECTURE.md`.
- 2026-10-14: Owner specified that modals and menus close when clicking outside
  them. Before the first ES module ships, update release/service-worker version
  stamping for module imports and change the local dev-server task so browser
  tests outside `docs/` can import app modules. Tracked in the implementation
  prerequisites checklist in `ARCHITECTURE.md`.
- 2026-10-14: Owner approved a shared transaction/request adapter with
  game-owned repositories and one application IndexedDB database with a shared
  settings store plus one store per game. Owner also approved closing old
  database connections on `versionchange`, waiting for them before upgrades,
  and showing displaced windows a friendly reload notice. Architecture
  contracts are captured in `ARCHITECTURE.md`; exact record schemas remain a
  separate discussion. Owner approved a shared save coordinator for the
  three one-second-spaced retries; repositories own the atomic operation and
  game-specific revert behavior.
- 2026-10-14: Owner approved Web Locks for writable-window ownership where
  available, with a tested IndexedDB lease/revision-check fallback that fails
  closed when ownership is ambiguous.
- 2026-10-14: Owner approved treating revision mismatches as conflicts rather
  than retryable save failures: stop moves and offer to load the latest save,
  discarding the unsaved action.
- 2026-10-14: Owner approved the settings interface: scoped reads/updates for
  application and game-type settings, definitions provide defaults and
  validation, missing values read as defaults without writes, invalid values
  are rejected, and per-deal options remain game-repository data.
- 2026-10-14: Owner decided new deals preselect the saved game-type settings
  (last-selected options); each deal also stores the options actually used.
- 2026-10-14: Owner decided that changing a game option on its home page
  immediately updates the saved last-selected settings, even if no deal starts.
- 2026-10-14: Owner approved the notification service boundary: callers pass
  message type/content and optional required-action/actions; the service owns
  lifecycle, timers, stack policy, and settings-driven rendering.
- 2026-10-14: Owner approved a separate modal service using `<dialog>` rather
  than combining modal behavior with notifications; shared design tokens or
  overlay ordering may still be used.
- 2026-10-14: Owner approved the modal service boundary: feature code supplies
  a title and DOM content; the service provides the dialog shell, focus
  lifecycle, Escape/outside-click closing, and returns close reason/value.
- 2026-10-14: Owner approved the application-menu contract with its persistent
  trigger at the top left (not top right), distinct from the game-specific
  in-game menu. An outside click closes the menu and keeps focus on its target;
  Escape closes the menu and restores focus to the trigger.
- 2026-10-14: Owner approved hash-based client-side routes for the static
  GitHub Pages site; routing must not depend on a server, backend, or rewrite
  configuration.
- 2026-10-14: Owner approved startup precedence: honor a valid explicit hash
  route; if none is present, restore the last stable context from IndexedDB.
- 2026-10-14: Owner approved stale-route handling: an unknown game routes to
  application Home; a missing attempt in a known game routes to that game's
  home. Show a friendly notification and do not silently substitute or delete
  data.
- 2026-10-14: Owner replaced explicit update approval with silent deferred
  updates: download while the browser checks online, keep the active version
  running until its clients close, and use the new version on next launch.
  Migrations run before restoring state and preserve records on failure.
- 2026-10-14: Owner approved the PWA boundary: `core/pwa` owns service-worker
  registration and verified cache readiness; the service worker handles only
  same-origin static assets; install-help detection is separate; updates are
  quiet and deferred until the old clients close.
- 2026-10-14: Owner approved a persistent offline-readiness status in Install
  App (Help), in addition to the transient notifications.
- 2026-10-14: Owner approved capability-first installation guidance with
  manual browser/platform selection when signals are uncertain; do not use
  device fingerprinting or make install support claims from weak hints.
- 2026-10-14: Owner chose a lightweight migration baseline only: version stored
  data, preserve it if migration fails, and show a friendly error. Defer
  specialized backup/rollback/recovery workflows unless a real need appears.
- 2026-10-14: Owner approved cache readiness as a check of every required
  same-origin asset in the current release manifest on app start and when help
  opens; browser eviction makes any stored readiness flag non-authoritative.
- 2026-10-14: Owner approved quiet background cache repair/status: unrelated
  cache failures stay in Install App (Help) without notifications; notify only
  when a failure blocks or degrades the feature currently being used.
- 2026-10-14: Owner chose cache repair at meaningful triggers (first load,
  connectivity restored, or Help opened), at most once per trigger; no polling
  or rapid automatic retry loop.
- 2026-10-16: Owner approved blocking gameplay and settings writes when
  IndexedDB is unavailable or a required migration fails; static Help/About
  may remain available, but volatile-only gameplay is not allowed.
- 2026-10-16: Owner approved startup composition: render shell, start service
  worker/cache work in background, open/upgrade IndexedDB, load settings and
  theme, establish writable/read-only ownership, resolve explicit hash or saved
  context, then load and render the view.
- 2026-10-16: Owner decided the modal service allows one open modal; concurrent
  open requests are rejected explicitly rather than stacked or replacing the
  current modal.
- 2026-10-16: Owner decided modal close restores focus only when the opener
  remains connected; if it was removed, do not move focus to an arbitrary
  fallback element.
- 2026-10-16: Owner decided modal Escape, outside-click, and Cancel/close
  resolve uniformly as dismissed; callers do not need to distinguish them.
- 2026-10-16: Owner approved updating an existing notification by its handle,
  preserving its identity and resetting its timer when applicable.
- 2026-10-16: Owner decided required-action notifications may omit action
  buttons when they explain a condition without a direct action.
- 2026-10-16: Owner decided open read-only windows should apply another
  window's settings changes immediately; they re-read the authoritative value
  from IndexedDB and remain unable to write.
- 2026-10-16: Owner confirmed implementation mechanisms (record schemas,
  exact module/folder structure, browser ownership fallback, and PWA
  cache/update mechanics) remain provisional until validated with Klondike.
  Approved behavior and service boundaries remain the contract; behavioral
  changes require owner discussion.
- 2026-10-16: Owner agreed to focus the current spike on application-wide and
  shared-core requirements. Klondike-specific rules, detailed storage schema,
  presentation, and related feature details are explicitly deferred to
  follow-up design rather than blocking this scope.
- 2026-10-17: Owner kept rendering and animation architecture open, noting the
  desired presentation includes substantial card movement transitions as cards
  move between locations and pile ordering changes. Drag-and-drop is required;
  tap/click selection followed by choosing a destination is not a substitute.
  Double-clicking a card performs an available move according to game-specific
  decision rules.
- 2026-10-14: Owner approved a minimal theme contract: CSS custom-property
  tokens, a default theme, optional token-only theme overrides, and a validated
  application setting when multiple themes are offered; no theme framework.