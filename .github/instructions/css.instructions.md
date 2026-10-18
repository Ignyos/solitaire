---
description: "CSS clean-code and theming rules for the Solitaire app."
applyTo: "**/*.css"
---
# CSS rules

## Theming

- Components use only semantic CSS custom properties, such as
  `--color-surface`, `--color-text`, `--color-accent`, or `--space-md`.
  Never use raw color values inside component rules.
- Themes define those properties under `:root[data-theme="<name>"]`.
  The default theme is also defined on plain `:root`.
- Adding a theme must require only a new set of property values, not component
  changes.

## Structure

- Sizes and spacing come from shared custom properties.
- Prefix class names with their component, such as `.notification-card`.
- Never style by ID.
- Write mobile-first: base rules for small screens, `min-width` media queries
  for larger ones.

## Motion and focus

- Animations follow the user's animation setting (Slide, Fade, or None).
- Never remove a focus outline without a visible replacement; use
  `:focus-visible` for keyboard focus styling.
