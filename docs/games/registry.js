/** @module Solitaire game registry */

import { klondikeRules } from './klondike/rules.js?v=2026-11-28-00-39';

/**
 * @typedef {Object} GameDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ title: string, introduction: string, sections: Array<{ heading: string, paragraphs: string[] }> }} rules
 * @property {import('../core/game-settings.js?v=2026-11-28-00-39').GameOption[]} options
 */

/** @type {GameDefinition[]} */
export const games = [
  {
    id: 'klondike',
    name: 'Klondike',
    description: 'Build four foundations and clear the tableau.',
    rules: klondikeRules,
    options: [{
      id: 'draw',
      label: 'Cards to draw',
      defaultValue: 1,
      choices: [{ value: 1, label: 'One card' }, { value: 3, label: 'Three cards' }]
    }]
  }
];
