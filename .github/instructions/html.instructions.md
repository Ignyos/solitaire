---
description: "HTML semantics, accessibility, and keyboard-navigation rules for the Solitaire app."
applyTo: "**/*.html"
---
# HTML rules

The same rules apply to markup created from JavaScript.

## Semantics

- Use meaningful elements: `<button>` for actions, `<a>` for navigation,
  `<dialog>` for modals, and headings in order.
- Every control has an accessible name that screen readers can announce.

## Keyboard navigation

- Every interactive control can be reached with Tab and operated with the
  keyboard.
- Tab order follows the visual order. Never use a positive `tabindex`.
- Focus is always visible.
- Modals move focus inside when opened, keep it there while open, and return it
  to the opening control when closed. Escape and clicking outside the modal
  close it.
- Menus close when the user clicks outside the open menu.

## Scripts

- Load application scripts as `<script type="module">`.
- Asset URLs carry the release `?v=` stamp; never add or edit stamps by hand.
