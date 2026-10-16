# Solitaire architecture

This document owns code structure: shared versus game-specific code, import
rules, the game contract, and the catalog of reusable shared code. Product
behavior lives in `REQUIREMENTS.md`; coding style lives in
`.github/instructions/`.

## Platform

- Static site on GitHub Pages; no server backend, Node runtime, bundler, or
  build step.
- Native ES modules loaded by the browser.
- Release-stamped `?v=` URLs apply to module import paths as well as to
  `<script>`/`<link>` tags, so a release never mixes cached old modules with new
  ones. The release scripts and service worker must support this before the
  first module ships.
- Pure logic is tested by an in-repo, dependency-free browser test runner in
  `tests/`, opened through the local dev server and never deployed.

## Approved core contracts at a glance

- **Platform:** static GitHub Pages app; native browser ES modules; no server,
  Node runtime, bundler, or runtime CDN dependencies.
- **Code boundaries:** shared code never imports games; games may use shared
  code but never import another game. Game logic is pure. Consult the
  shared-code catalog before adding reusable helpers.
- **Storage:** one IndexedDB database, with one shared settings store and one
  object store per game. Shared storage owns connection/transaction mechanics;
  settings and game repositories own their domain operations and schemas.
- **Durable actions:** board snapshot and undo history change atomically.
  Automatic consequences are part of the action's undo step. Winning or
  forfeiting records the outcome and deletes move history atomically.
- **Write safety:** one writable window; Web Locks with a tested, fail-closed
  fallback and transactional revision checks. Revision conflicts stop play and
  offer to load the latest save, not retry stale actions.
- **Save failures:** shared coordinator retries the same atomic operation up to
  three times, one second apart, each in a fresh transaction. On final failure,
  block moves and offer manual Retry or Revert to the last save.
- **Settings:** definitions provide defaults and validation. Missing values
  read as defaults without writes; invalid values are rejected. Game-home option
  changes save immediately as that game's last-selected settings; each deal
  stores its actual options.
- **Notifications:** callers supply type, friendly message, and optional
  required actions; the notification service owns timers, stack policy, and
  settings-driven display. Errors affecting current use are surfaced; unrelated
  background cache failures remain quiet.
- **Modals and menus:** separate services. Modals use `<dialog>` and own focus,
  Escape, outside-click, and return-value lifecycle. The persistent application
  menu is top-left, distinct from a game's in-game menu.
- **Navigation:** hash routes for Home, game home, and an attempt. A valid
  explicit route wins on startup; otherwise restore the last stable saved view.
  Stable navigation waits for pending writes; transient overlays are not saved.
- **Offline and updates:** verify every required same-origin asset in the
  release manifest; show readiness persistently in Install App (Help), and keep
  unrelated cache repair quiet. Updates wait until old clients close and apply
  on next launch without an update prompt. Migrations preserve data and report
  failure without adding specialized recovery workflows.
- **Themes:** semantic CSS custom properties with a default theme and optional
  token-only overrides; no theme framework.
- **Game scope:** Klondike is first. Its implementation validates the
  provisional folder structure and informs the reusable game implementation
  guide.

## Validation boundary

The approved product behavior and service responsibilities above are the
current contract. Implementation mechanisms remain provisional until exercised
by the first game (Klondike), including:

- Exact storage record schemas, indexes, and module API signatures.
- The folder/module layout and game contract details beyond approved
  responsibilities.
- Cross-browser writable-window fallback mechanics.
- Cache verification, asset-manifest generation, and service-worker lifecycle
  implementation details.

Klondike implementation may refine these mechanisms based on demonstrated
needs. It must not silently change approved user-visible behavior; behavioral
changes return to owner discussion.

## Core contract acceptance checklist

Use this checklist when core services are implemented. Each result is
observable at the UI or durable-state boundary; tests should not depend on
internal helper names or the provisional folder layout.

### Startup and navigation

- [ ] Startup renders the application shell without waiting for service-worker
  registration or cache repair.
- [ ] IndexedDB upgrades complete before settings/context are read. The app
  applies settings, chooses a valid explicit hash route or otherwise restores
  the last stable context, then renders that view.
- [ ] Startup never reopens transient About, Help, or Settings overlays.
- [ ] An unknown game route falls back to application Home; a missing attempt
  for a known game falls back to that game's home. Both show a friendly
  notification and preserve stored data.
- [ ] Route changes wait for pending durable writes before changing the view.
- [ ] If IndexedDB cannot open or a required migration fails, gameplay and
  settings writes are blocked, a friendly message is shown, and static
  Help/About content remains available.

### Persistence and ownership

- [ ] A user action and its automatic consequences update the attempt snapshot
  and undo history atomically. Undo atomically restores the prior snapshot and
  removes that action from history.
- [ ] Winning or forfeiting atomically records the outcome and removes move
  history.
- [ ] A storage write gets at most three automatic retries, each one second
  apart and in a fresh transaction. After final failure, moves stop and the
  user can Retry or Revert to the last saved snapshot.
- [ ] A revision conflict is not retried automatically; moves stop and the
  user can explicitly load the latest saved state.
- [ ] At most one window can write. Other windows are read-only; ownership
  takeover reloads the latest snapshot and undo history before writes resume.
- [ ] On `versionchange`, an open window stops storage activity, closes its
  database connection, and presents the approved reload notice.

### Settings and UI services

- [ ] An unset setting reads as its declared default without writing it;
  invalid or unknown settings are rejected.
- [ ] Changing game options immediately persists the last-selected values.
  Other open read-only windows re-read and apply changes from IndexedDB.
- [ ] Notification cards follow configured defaults (upper-right below the
  application menu, Fade In/Out, 3 seconds, announcements off, maximum 3).
  Hover/focus pauses dismissal; required-action cards do not auto-dismiss.
- [ ] When a fourth notification arrives, the oldest non-error card is removed;
  if all visible cards are errors, the new card waits. With announcements off,
  no notification is announced.
- [ ] Updating a notification handle updates the existing card rather than
  adding another card; applicable timers restart.
- [ ] Only one modal opens at a time; a concurrent open is rejected. Escape,
  outside click, and Cancel/close resolve as dismissed. Focus returns to the
  opener only if it remains in the document.
- [ ] The application menu is present on Home, game home, and gameplay.
  Outside click closes it without stealing focus; Escape closes it and returns
  focus to the trigger.

### Offline and update behavior

- [ ] Offline-ready is reported only when every required same-origin asset in
  the current release manifest is cached. The check runs on app startup and
  when Install App (Help) opens; that page keeps a persistent readiness status.
- [ ] Background cache repair runs only at the agreed triggers and does not
  notify unless the missing resource affects the feature currently in use.
- [ ] An update does not prompt or reload the running app. The new worker waits
  for old clients to close and is used on a later launch.

## Implementation prerequisites for this branch

Complete these before the first ES module ships:

- [ ] Update the release tooling and service worker to apply the release
  `?v=` stamp consistently to module import paths and cached module assets.
- [ ] Update the local VS Code dev-server task to serve the repository root
  (or an equivalent layout) so the browser test page in `tests/` can import
  application modules from `docs/`. Keep the test page outside deployed
  `docs/`.

## Folder structure (provisional)

This structure is a suggestion until the Klondike implementation confirms it.

```
docs/
  main.js            app startup and page routing
  core/              storage, ownership lock, settings, notifications,
                     menu, modals, install help, update handling, themes
  cards/             card and deck models, shuffle, deal fingerprint,
                     piles, move history and Undo
  shared-ui/         game home page, history list, in-game menu shell,
                     card display
  games/
    registry.js      the list of games shown in the gallery
    klondike/
      index.js       the game's definition, following the game contract
      options.js     options, each marked layout-changing or rule-only
      deal.js        builds the starting board from the card order
      rules.js       pure functions: legal moves, automatic follow-ups, win check
      store.js       the game's own IndexedDB store and its upgrades
      view.js, klondike.css
tests/
  test.html          browser test runner page
```

## PWA/offline/update boundary (approved)

### Approved update policy

- Download updates quietly when the browser checks the service worker while
  online. Static hosting requires no backend; timing is controlled by browser
  service-worker checks, so an update is not guaranteed to download immediately.
- Leave the running application version unchanged. Do not show an
  update-available notification, prompt for approval, or force a reload.
- Let the new worker wait until all clients controlled by the old worker close.
  It then activates naturally; the next launch uses the new version.
- Persist gameplay after every action. Apply database/game-state migrations
  during startup before restoring the saved context. A migration failure must
  preserve existing records and be reported through the friendly error layer.
- Do not add backup, rollback, or specialized migration-recovery workflows
  unless a demonstrated need arises.

### Service responsibilities (approved)

- `core/pwa/` registers the service worker, observes installation/update state,
  prepares and verifies the required asset cache, and reports status to the
  application.
- `service-worker.js` caches only same-origin, release-versioned application
  assets. It does not own IndexedDB game state or UI.
- Offline-ready means every required same-origin URL in the current release
  manifest has a matching cached response. Recheck on app startup and when
  Install App (Help) opens; a stored readiness flag is not authoritative because
  the browser may evict cached resources.
- Cache preparation and repair run quietly in the background when online.
  Maintain Preparing, Ready, or Not Ready in the persistent Install App (Help)
  status. A successful registration alone does not mean offline readiness;
  missing manifest entries mean Not Ready.
- Attempt preparation on first load. If incomplete, attempt repair again when
  connectivity returns or when Install App (Help) opens, at most once per
  trigger. Do not poll or run rapid automatic retry loops.
- Do not notify about a background cache failure when it does not affect the
  current user flow. If a missing resource blocks or degrades the feature
  currently being used, show a friendly notification/error with retry guidance.
- A waiting worker does not activate while old-version clients are open. Do
  not call `skipWaiting()` to bypass this lifecycle.
- Installation-help content is a separate feature from cache readiness. It
  uses capability-first guidance and retains manual browser/platform selection
  when detection signals are uncertain. Do not use device fingerprinting.
- All modules and their versioned URLs must be included in the cache asset
  manifest. Update/version stamping must remain consistent with release tooling.

Exact release-manifest generation and cached-response verification mechanics
are implementation details; the readiness criterion and recheck behavior are
defined above.
The current starter service worker immediately calls `skipWaiting()` and
`clients.claim()`; its immediate-activation behavior must be replaced with the
approved deferred lifecycle.

## Import rules

- Shared code (`core/`, `cards/`, `shared-ui/`) never imports from `games/`.
- A game may import shared code but never another game.

## Storage boundary

The responsibility split, database topology, and upgrade coordination below
are approved. Exact durable record fields and indexes are reserved for a
separate discussion.

### Confirmed constraints

- IndexedDB is the durable store.
- One shared settings store holds application-wide settings and each game's
  type-wide settings. Each game owns a separate object store for its data,
  including per-deal options.
- A move, its automatic consequences, the updated attempt snapshot, and its
  undo-history entry save atomically. Undo updates the snapshot and history
  atomically. Win/forfeit records the outcome and removes move history
  atomically.
- Failed saves get three automatic retries one second apart; after that, block
  moves and offer Retry or Revert to last save.
- Database migrations must preserve existing records on failure.
- One application window writes at a time; writes also check revisions to
  reject stale state.

### Approved responsibility split

- `core/storage/` owns opening/closing the IndexedDB connection, database
  upgrades, transaction lifecycle, request/error normalization, and storage
  availability handling. It does not know Solitaire rules or game record
  fields.
- A shared settings repository owns reads/writes to the settings store.
- Each game supplies a declarative store definition (store name, indexes, and
  versioned upgrade steps) and owns its repositories/domain-specific
  transactions. This keeps schemas game-specific without letting one game
  import another.
- The application composition layer passes all registered game store
  definitions to the shared storage initializer. Shared storage must not import
  the game registry, preserving the import direction.
- Application context/navigation persistence is a shared concern. Its record
  shape and whether it has a separate object store remain open.

Shared storage exposes a small transaction/request adapter. The settings
repository and each game's repository build domain operations on it. The
adapter makes the transaction's object stores and read/write mode explicit,
and provides scoped requests without exposing connection lifecycle management
to callers.

### Transaction boundary

Every domain operation that must be atomic is one IndexedDB read-write
transaction covering all affected stores. For example, recording a win updates
the attempt and removes its move history in one transaction. A transaction
must not await network work, timers, or unrelated asynchronous work; IndexedDB
may deactivate an idle transaction.

The adapter must make transaction scope explicit, prevent writes without
application ownership, verify expected revisions transactionally, and surface
failures to the friendly UI error layer while retaining full console details.

Revision mismatches are conflicts, not retryable storage failures. Stop further
moves, report that progress changed elsewhere, and offer to load the latest
durable snapshot; this discards the unsaved action. Do not replay or blindly
retry the stale operation.

### Save coordinator (approved responsibility)

The shared save coordinator owns the approved three retries, spaced one second
apart. Each retry starts a fresh IndexedDB transaction for the same pending
atomic operation; it never attempts to reuse an aborted transaction. It does
not retry revision conflicts. Game repositories define the operation and
provide the game-specific action for reverting to the last durable snapshot.
The coordinator reports final storage failure to the UI error layer and keeps
the pending operation available for manual Retry or Revert.

### Database topology (approved)

Use one application IndexedDB database containing one shared settings store and
one object store per game. The shared storage initializer receives each
registered game's store definition from the application composition layer.
Database version upgrades create or update stores and indexes; game-specific
migration steps remain owned by that game's definition.

Record fields, indexes, database naming/version constants, and exact API
signatures are intentionally deferred to the storage-schema discussion.

### Writable-window ownership (approved direction)

- Use the Web Locks API where available, with an IndexedDB lease and
  transactional revision checks as the tested fallback.
- BroadcastChannel may notify windows of ownership/state changes; it is not a
  lock.
- If fallback ownership is ambiguous, fail closed: do not allow writes until
  ownership can be established.
- Explicit takeover must make the previous owner read-only and reload the
  latest durable state before the new owner resumes writes.

### Coordinating database upgrades (approved)

- Every application window closes its database connection on `versionchange`
  and stops storage activity.
- A window requesting an upgrade waits for older connections to close, then
  performs the versioned upgrade.
- A window displaced by an upgrade shows a friendly notice such as
  “Updating—please reload.” It does not continue using the closed connection.

## Settings interface

The settings repository owns only the application-wide and game-type settings
(layers 1 and 2). Layer-3 options belong to a specific deal and are read/written
through that game's repository.

Approved caller-facing operations:

- Read an application setting by its declared key.
- Update an application setting by key and value.
- Read a game's type-wide setting by game id and declared key.
- Update a game's type-wide setting by game id, key, and value.

Setting definitions live with the feature or game that owns them and provide
the key, default value, and validation. Reads return the declared default when
no value has been saved, without writing that default as a side effect.
Updates reject unknown keys and invalid values rather than silently storing or
substituting them. The repository persists valid values in the shared settings
store and routes failures through the shared save/error behavior. Every change
to a game's selected options on its home page updates that game's type-wide
last-selected settings immediately, even if no deal is started.

This leaves the persistent record shape private to the repository and avoids
duplicating defaults or validation in UI components. Exact API naming, whether
settings definitions are registered centrally, and exact API naming remain
open.

When another window changes a setting, open read-only windows receive a
change notification and re-read the value from IndexedDB before applying it
live. The notification is only a signal; the database remains authoritative.
Read-only windows do not write settings themselves.

## Notification service interface

The notification service owns notification lifecycle and policy; a separate
view renders cards. Callers provide meaning and behavior, not presentation.

Approved caller contract:

- `show({ type, message, requiresAction?, actions? })` creates a notification
  and returns a handle.
- `type` is `error`, `warning`, `information`, or `success`. The view supplies
  the corresponding color and icon/label.
- `message` is short, friendly text. Full technical error details are logged
  by the caller to the console, not displayed in the card.
- `requiresAction` prevents automatic dismissal. An `actions` list supplies
  accessible, labeled buttons for operations such as Retry and Revert; actions
  are optional when the card only explains a blocked condition.
- The returned handle allows a caller to update the notification in place,
  dismiss it, or resolve it after its condition is handled. Updating retains
  card identity and resets the auto-dismiss timer when applicable. The card's
  close button can also dismiss it.
- Notifications without `requiresAction` use the configured duration; the
  service applies hover/focus pause and the maximum-stack/overflow rules.
- The view reads location, animation, and announcement preferences from the
  settings interface. Callers cannot override color, position, or animation.
- When announcements are disabled, the service makes no screen-reader
  announcements, including for errors.

The exact function/handle names remain open.

### Modal relationship (approved)

Keep modals as a separate service and use `<dialog>` for modal content.
Notifications are non-blocking, stackable messages; modals interrupt the
current task and manage focus, Escape, and outside-click dismissal. They may
share design tokens and a small overlay-ordering convention, but do not share
one show/dismiss API.

## Modal service interface

The modal service owns the dialog shell and lifecycle; the feature that opens a
modal owns its content and actions.

Approved caller contract:

- `open({ title, content })` accepts an accessible title and a DOM content
  element, then opens one modal `<dialog>`.
- The service associates the title with the dialog for its accessible name.
- The service moves focus into the dialog, keeps keyboard focus within it,
  makes Escape and outside clicks close it, and restores focus to the opener
  when closed if that opener is still connected to the document. If it has
  been removed, do not restore focus to an arbitrary element.
- The service returns a promise that resolves with the close reason and any
  caller-provided return value. Escape, outside-click, and Cancel/close
  resolve uniformly as dismissed; callers do not distinguish the dismissal
  mechanism.
- Only one modal may be open at a time. A concurrent `open` request is rejected
  explicitly; it does not replace or stack over the current modal.
- Modal content owns its buttons and form semantics; the service does not
  prescribe About, Settings, or confirmation-dialog content.
- The service does not expose options to disable Escape/outside-click closing.

The exact result type remains an implementation detail.

## Application menu interface

The application shell owns one persistent top-left menu trigger. It is
available on application Home, each game home, and gameplay. This is distinct
from a game's own in-game menu.

Approved contract:

- Render the application menu from one shared component with the fixed
  application entries: Install App (Help), Home, Settings, and About.
- Use a labeled disclosure button with `aria-expanded` and `aria-controls`,
  followed by ordinary links/buttons in a list. Do not use ARIA `menu` roles,
  which imply arrow-key menu behavior; standard Tab navigation remains natural.
- The menu component owns open/closed state. It closes after selection or a
  click outside. Escape closes it and returns focus to the trigger. An outside
  click closes the panel but leaves focus on the clicked target.
- The application shell supplies item handlers. The menu does not own route
  changes, settings content, install help, or About modal content.
- Selecting an item closes the menu before invoking its handler. Navigation
  handlers wait for pending durable writes where required.
- The trigger remains reachable and unobstructed by notifications.

The exact API shape, item visuals, and responsive panel placement remain open.

## Navigation/router interface

The router owns stable application navigation and delegates rendering to the
application composition layer. It does not render game-specific views or own
game rules.

Approved route model:

- Application home.
- A game's home, identified by game id.
- Gameplay for one attempt, identified by game id and attempt id.

Approved router behavior:

- All stable-view changes pass through the router; menu and gallery handlers
  request navigation instead of changing the DOM directly.
- Before changing routes, wait for pending durable writes. Then persist the
  destination as the last stable application context and render it.
- On startup, restore the last stable context. Do not restore transient
  overlays such as About, Install Help, or Settings.
- Keep transient overlay state out of route/context persistence.
- Handle browser Back/Forward through the same route-change path and save the
  resulting stable context.
- The router receives route renderers/handlers from the application
  composition layer; it does not import game modules.

### Route encoding (approved)

Use hash-based routes, such as `#/home`, `#/games/klondike`, and
`#/games/klondike/attempts/<id>`. The app remains a static file site; routes
must not require a server, backend, or rewrite/fallback configuration.
Hash changes support browser Back/Forward. The durable saved context remains
available for startup restoration.

On startup, a valid explicit hash route takes precedence. If no explicit route
is present, restore the last stable context from IndexedDB.

If an explicit route names an unknown game, route to application Home and show
a friendly notification. If the game exists but the named attempt does not,
route to that game's home and show a friendly notification. Do not silently
open a different game or delete data.

Whether game-home UI state such as history scroll is restored remains open.

## Theme interface

Approved approach: keep theming to CSS custom properties and the
application-wide settings repository; do not introduce a theme framework.

- Define semantic color, spacing, and other design tokens in CSS.
- The default theme supplies token values on `:root`. Additional themes
  override the same tokens under `:root[data-theme="<theme-id>"]`.
- Components consume tokens rather than defining theme-specific colors.
- If/when multiple themes are offered, a validated application setting stores
  the selected theme id. On startup, apply that saved selection before
  rendering; otherwise use the default theme.
- Theme selection persists through the existing settings interface. Theme
  definitions remain CSS data, not JavaScript style objects.

One default theme can ship first; adding a selector and additional themes is
not required until those themes are designed.

## Application startup/composition

The composition root (`main.js`) wires services together. Keep startup ordered
only where a dependency requires it; unrelated PWA work must not delay access
to the application.

Approved sequence:

1. Render the static application shell and establish a friendly fatal-error
   surface.
2. Start service-worker registration/cache verification in the background.
   Report offline readiness separately; do not block the app shell on it.
3. Open IndexedDB and complete required upgrades/migrations before reading
   persisted application state.
4. Load application settings and apply theme/display preferences.
5. Establish writable-window ownership. A window without ownership can still
   read and render in read-only mode.
6. Resolve the startup route: valid explicit hash first, otherwise the last
   stable saved context.
7. Load the data needed for that route and render it. Keep transient overlays
   closed on startup.

The composition root passes service interfaces, game definitions, and route
renderers explicitly; shared services do not discover/import game modules.
Optional background work (cache preparation, update checks) reports status
without holding up a usable view.

If IndexedDB cannot be opened or a required migration fails, show a friendly
blocking message and disable gameplay and settings writes. Static Help/About
content may remain available. Do not offer volatile-only gameplay that could
lose unsaved progress.

## Game contract

Every game exports one definition object containing:

- Its id, name, and version.
- Its option definitions, each classified as layout-changing or rule-only.
- `deal(cardOrder, layoutOptions)`, returning the starting state.
- `applyAction(state, action)`, returning the new state together with its
  automatic follow-ups as one undo step.
- `isWon(state)`.
- Its IndexedDB store schema and upgrades.
- Its display functions.

The shared game home, history, Retry, Resume, Forfeit, Undo, and saving all work
through this contract. The game implementation guide documents it in detail.

## Shared versus game-specific code

- Clearly generic parts are shared from the start: cards, deck, shuffle, piles,
  Undo, saving, and the game home page.
- Everything else stays inside its game until a second game needs it, then
  moves to shared code.

## Shared-code catalog

Before writing a helper, check this catalog and reuse an existing export.
Update it in the same change that adds, renames, or removes a shared export.

| Module | Export | Purpose |
|---|---|---|
| *(none yet)* | | |
