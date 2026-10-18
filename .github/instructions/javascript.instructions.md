---
description: "JavaScript clean-code rules for the Solitaire app and its browser tests."
applyTo: "docs/**/*.js, tests/**/*.js"
---
# JavaScript rules

Follow `ARCHITECTURE.md` for module structure, import rules, and the game contract.

## Reuse before writing

- Before writing a helper, check the shared-code catalog in `ARCHITECTURE.md`.
  Use an existing export instead of re-implementing it.
- When you add, rename, or remove a shared export, update the catalog in the
  same change.
- Keep game-specific code inside its game folder until a second game needs it.

## Modules

- Use native ES modules (`<script type="module">`, `import`/`export`). No
  bundler, transpiler, Node runtime, or build step.
- Use named exports. No default exports and no global variables.
- Import with relative paths that include the `.js` extension.
- Each module has one responsibility.
- Shared modules start with a one-line `/** @module ... */` summary.

## Game logic stays pure

- Rule functions take a state and return a new state. Never mutate inputs.
- Rule modules never touch the DOM, IndexedDB, timers, randomness, or the clock.
  Pass such values in as arguments.

## Syntax

- `const` by default, `let` only when reassigned, never `var`.
- Always use strict equality (`===`, `!==`).
- Write small functions; return early instead of nesting.
- Give fixed numbers a named constant instead of a bare literal.

## Naming

- camelCase for functions and variables.
- PascalCase for classes.
- UPPER_SNAKE_CASE for constants.
- kebab-case for file names.

## Comments and types

- Comments explain *why*, not *what*.
- Exported functions have JSDoc type annotations (`@param`, `@returns`,
  `@typedef`) so the editor can check types without a build step.

## Errors

- Never swallow an error.
- Handle failures where the app meets the browser or IndexedDB.
- Show the user a short, friendly message through the notification system.
- Log the full error with context to the console with `console.error`.

## Dependencies

- No third-party runtime libraries without owner approval.
- Load nothing from external servers or CDNs at runtime; everything ships in `docs/`.

## Tests

- Test pure logic with the in-repo browser test runner in `tests/`.
- Tests live outside `docs/` and are never deployed.
