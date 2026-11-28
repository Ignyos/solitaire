/** @module Persistent per-game options and new-game display preference */

import { SETTINGS_STORE, requestResult, withTransaction } from './storage.js?v=2026-11-28-00-39';

const DISPLAY_SETTING = 'show-options-before-new-games';

/**
 * @typedef {{ id: string, label: string, defaultValue: string | number,
 *   choices: Array<{ value: string | number, label: string }> }} GameOption
 * @typedef {{ id: string, options: GameOption[] }} GameSettingsDefinition
 * @typedef {{ options: Record<string, string | number>, showOptions: boolean }} GameSettings
 */

/**
 * @param {IDBDatabase} database
 * @param {GameSettingsDefinition} game
 * @returns {Promise<GameSettings>}
 */
export function readGameSettings(database, game) {
  return withTransaction(database, [SETTINGS_STORE], 'readonly', async transaction => {
    const store = transaction.objectStore(SETTINGS_STORE);
    /** @type {Record<string, string | number>} */
    const options = {};
    for (const option of game.options) {
      const saved = await requestResult(store.get([game.id, option.id]));
      const value = saved === undefined ? option.defaultValue : saved;
      if (!option.choices.some(choice => choice.value === value)) {
        throw new Error(`The saved ${game.id} ${option.id} option is invalid.`);
      }
      options[option.id] = value;
    }
    const savedDisplay = await requestResult(store.get([game.id, DISPLAY_SETTING]));
    if (savedDisplay !== undefined && typeof savedDisplay !== 'boolean') {
      throw new Error(`The saved ${game.id} options display preference is invalid.`);
    }
    return { options, showOptions: savedDisplay === undefined ? true : savedDisplay };
  });
}

/**
 * @param {IDBDatabase} database
 * @param {GameSettingsDefinition} game
 * @param {string} optionId
 * @param {string | number} value
 * @returns {Promise<void>}
 */
export function saveGameOption(database, game, optionId, value) {
  const option = game.options.find(entry => entry.id === optionId);
  if (!option || !option.choices.some(choice => choice.value === value)) {
    throw new TypeError('The selected game option is invalid.');
  }
  return withTransaction(database, [SETTINGS_STORE], 'readwrite', async transaction => {
    await requestResult(transaction.objectStore(SETTINGS_STORE).put(value, [game.id, optionId]));
  });
}

/**
 * @param {IDBDatabase} database
 * @param {string} gameId
 * @param {boolean} showOptions
 * @returns {Promise<void>}
 */
export function saveOptionsDisplay(database, gameId, showOptions) {
  if (typeof showOptions !== 'boolean') throw new TypeError('The display preference must be boolean.');
  return withTransaction(database, [SETTINGS_STORE], 'readwrite', async transaction => {
    await requestResult(transaction.objectStore(SETTINGS_STORE).put(showOptions, [gameId, DISPLAY_SETTING]));
  });
}
