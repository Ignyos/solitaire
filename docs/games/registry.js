/** @module Solitaire game registry */

import { klondikeRules } from './klondike/rules.js?v=2026-10-21-23-35';

/**
 * @typedef {Object} GameDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ title: string, introduction: string, sections: Array<{ heading: string, paragraphs: string[] }> }} rules
 */

/** @type {GameDefinition[]} */
export const games = [
  {
    id: 'klondike',
    name: 'Klondike',
    description: 'Build four foundations and clear the tableau.',
    rules: klondikeRules
  }
];
