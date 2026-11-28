/** @module Durable Klondike deal and attempt records */

import { APPLICATION_STORE, SETTINGS_STORE, requestResult, withTransaction } from '../../core/storage.js?v=2026-11-28-00-39';
import { dealKlondike } from './deal.js?v=2026-11-28-00-39';
import { applyKlondikeAction } from './moves.js?v=2026-11-28-00-39';

export const KLONDIKE_STORE = 'klondike';
const LAYOUT_KEY = 'standard';
const DEALING_VERSION = 1;
const ACTIVE_KEY = ['active'];
const DRAW_SETTING = ['klondike', 'draw'];

export class AttemptStateError extends Error {
  constructor() {
    super('The saved attempt is not in the expected state.');
    this.name = 'AttemptStateError';
  }
}

/**
 * @param {IDBDatabase} database
 * @returns {void}
 */
export function upgradeKlondikeStore(database) {
  if (!database.objectStoreNames.contains(KLONDIKE_STORE)) {
    const store = database.createObjectStore(KLONDIKE_STORE);
    store.createIndex('fingerprint', 'fingerprint');
  }
}

/**
 * @param {IDBDatabase} database
 * @returns {Promise<Object | null>}
 */
export function readActiveAttempt(database) {
  return withTransaction(database, [KLONDIKE_STORE], 'readonly', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const activeId = await requestResult(store.get(ACTIVE_KEY));
    if (activeId === undefined) return null;
    const attempt = await requestResult(store.get(['attempt', activeId]));
    if (!attempt || attempt.outcome !== 'unfinished') {
      throw new Error('The active Klondike attempt is missing or invalid.');
    }
    return attempt;
  });
}

/**
 * @param {IDBDatabase} database
 * @param {string} attemptId
 * @returns {Promise<Object | null>}
 */
export function readAttempt(database, attemptId) {
  return withTransaction(database, [KLONDIKE_STORE], 'readonly', async transaction => {
    const attempt = await requestResult(transaction.objectStore(KLONDIKE_STORE).get(['attempt', attemptId]));
    return attempt ?? null;
  });
}

/**
 * @param {IDBDatabase} database
 * @returns {Promise<Array<{ latest: Object, attemptCount: number }>>}
 */
export function readFinishedDeals(database) {
  return withTransaction(database, [KLONDIKE_STORE], 'readonly', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const attempts = await requestResult(store.getAll(IDBKeyRange.bound(['attempt'], ['attempt', []])));
    const deals = new Map();
    for (const attempt of attempts) {
      const key = JSON.stringify([attempt.layoutKey, attempt.dealNumber]);
      if (!deals.has(key)) deals.set(key, { latest: null, attemptCount: 0 });
      const entry = deals.get(key);
      entry.attemptCount += 1;
      if (attempt.outcome === 'unfinished') continue;
      if ((attempt.outcome !== 'forfeit' && attempt.outcome !== 'won') ||
          !Number.isFinite(attempt.finishedAt)) {
        throw new Error('A saved Klondike attempt has an invalid outcome or finish time.');
      }
      if (!entry.latest || attempt.finishedAt > entry.latest.finishedAt ||
          (attempt.finishedAt === entry.latest.finishedAt && attempt.startedAt > entry.latest.startedAt)) {
        entry.latest = attempt;
      }
    }
    return Array.from(deals.values()).filter(entry => entry.latest);
  });
}

async function replaceActiveAttempt(store, replace) {
  const activeId = await requestResult(store.get(ACTIVE_KEY));
  if ((activeId === undefined) !== (replace === null) ||
      (replace && activeId !== replace.id)) {
    throw new AttemptStateError();
  }
  if (!replace) return;
  const old = await requestResult(store.get(['attempt', activeId]));
  if (!old || old.outcome !== 'unfinished') throw new AttemptStateError();
  old.outcome = 'forfeit';
  old.elapsedMs = Math.max(old.elapsedMs, replace.elapsedMs);
  old.finishedAt = Date.now();
  await requestResult(store.put(old, ['attempt', activeId]));
  await requestResult(store.delete(IDBKeyRange.bound(['undo', activeId], ['undo', activeId, []])));
}

async function saveNewAttempt(transaction, attempt) {
  const store = transaction.objectStore(KLONDIKE_STORE);
  await requestResult(store.add(attempt, ['attempt', attempt.id]));
  await requestResult(store.put(attempt.id, ACTIVE_KEY));
  await requestResult(transaction.objectStore(APPLICATION_STORE).put(
    `#/games/klondike/attempts/${encodeURIComponent(attempt.id)}`, 'last-route'));
}

/**
 * @param {IDBDatabase} database
 * @param {{ attemptId: string, cards: import('./deal.js?v=2026-11-28-00-39').Card[], fingerprint: string, replace: { id: string, elapsedMs: number } | null }} input
 * @returns {Promise<Object>}
 */
export function createAttempt(database, { attemptId, cards, fingerprint, replace }) {
  if (typeof attemptId !== 'string' || !attemptId || !/^[0-9a-f]{64}$/.test(fingerprint)) {
    throw new TypeError('An attempt requires an id and a valid deal fingerprint.');
  }
  if (replace && (!Number.isFinite(replace.elapsedMs) || replace.elapsedMs < 0)) {
    throw new TypeError('The attempt elapsed time must be valid.');
  }
  const board = dealKlondike(cards);
  return withTransaction(database, [APPLICATION_STORE, SETTINGS_STORE, KLONDIKE_STORE], 'readwrite',
    async transaction => {
      const store = transaction.objectStore(KLONDIKE_STORE);
      await replaceActiveAttempt(store, replace);

      const savedDraw = await requestResult(transaction.objectStore(SETTINGS_STORE).get(DRAW_SETTING));
      const draw = savedDraw === undefined ? 1 : savedDraw;
      if (draw !== 1 && draw !== 3) throw new Error('The saved Klondike draw setting is invalid.');
      const counterKey = ['counter', LAYOUT_KEY];
      const previousNumber = await requestResult(store.get(counterKey));
      const dealNumber = (previousNumber ?? 0) + 1;
      const deal = { layoutKey: LAYOUT_KEY, dealNumber, dealingVersion: DEALING_VERSION, cards, fingerprint };
      const attempt = {
        id: attemptId, layoutKey: LAYOUT_KEY, dealNumber, options: { draw }, board,
        score: 0, moves: 0, elapsedMs: 0, outcome: 'unfinished',
        startedAt: Date.now()
      };
      await requestResult(store.put(dealNumber, counterKey));
      await requestResult(store.add(deal, ['deal', LAYOUT_KEY, dealNumber]));
      await saveNewAttempt(transaction, attempt);
      return attempt;
    });
}

/**
 * @param {IDBDatabase} database
 * @param {{ attemptId: string, sourceAttemptId: string, replace: { id: string, elapsedMs: number } | null }} input
 * @returns {Promise<Object>}
 */
export function retryAttempt(database, { attemptId, sourceAttemptId, replace }) {
  if (typeof attemptId !== 'string' || !attemptId ||
      typeof sourceAttemptId !== 'string' || !sourceAttemptId ||
      (replace && (!Number.isFinite(replace.elapsedMs) || replace.elapsedMs < 0))) {
    throw new TypeError('A retry requires valid attempt identifiers and elapsed time.');
  }
  return withTransaction(database, [APPLICATION_STORE, KLONDIKE_STORE], 'readwrite',
    async transaction => {
      const store = transaction.objectStore(KLONDIKE_STORE);
      const source = await requestResult(store.get(['attempt', sourceAttemptId]));
      if (!source || (source.outcome !== 'forfeit' && source.outcome !== 'won')) {
        throw new AttemptStateError();
      }
      const deal = await requestResult(store.get(['deal', source.layoutKey, source.dealNumber]));
      if (!deal || deal.dealingVersion !== DEALING_VERSION) {
        throw new Error('The saved deal is missing or uses an unsupported dealing version.');
      }
      if (source.options?.draw !== 1 && source.options?.draw !== 3) {
        throw new Error('The saved Klondike draw option is invalid.');
      }
      const board = dealKlondike(deal.cards);
      await replaceActiveAttempt(store, replace);
      const attempt = {
        id: attemptId, layoutKey: source.layoutKey, dealNumber: source.dealNumber,
        options: { ...source.options }, board, score: 0, moves: 0, elapsedMs: 0,
        outcome: 'unfinished', startedAt: Date.now()
      };
      await saveNewAttempt(transaction, attempt);
      return attempt;
    });
}

/**
 * @param {IDBDatabase} database
 * @param {{ id: string, elapsedMs: number }} input
 * @returns {Promise<Object>}
 */
export function checkpointAttempt(database, { id, elapsedMs }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new TypeError('The attempt elapsed time must be valid.');
  }
  return withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const attempt = await requestResult(store.get(['attempt', id]));
    if (!attempt || attempt.outcome !== 'unfinished') {
      throw new AttemptStateError();
    }
    attempt.elapsedMs = Math.max(attempt.elapsedMs, elapsedMs);
    await requestResult(store.put(attempt, ['attempt', id]));
    return attempt;
  });
}

/**
 * @param {IDBDatabase} database
 * @param {string} id
 * @returns {Promise<{ board: import('./deal.js?v=2026-11-28-00-39').KlondikeBoard, scoreDelta: number } | null>}
 */
export function readLastUndo(database, id) {
  return withTransaction(database, [KLONDIKE_STORE], 'readonly', async transaction => {
    const cursor = await requestResult(transaction.objectStore(KLONDIKE_STORE).openCursor(
      IDBKeyRange.bound(['undo', id], ['undo', id, []]), 'prev'));
    return cursor ? cursor.value : null;
  });
}

/**
 * @param {IDBDatabase} database
 * @param {{ id: string, elapsedMs: number, action: import('./moves.js?v=2026-11-28-00-39').KlondikeAction }} input
 * @returns {Promise<Object>}
 */
export function applyAttemptAction(database, { id, elapsedMs, action }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new TypeError('The attempt elapsed time must be valid.');
  }
  return withTransaction(database, [APPLICATION_STORE, KLONDIKE_STORE], 'readwrite', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const activeId = await requestResult(store.get(ACTIVE_KEY));
    const attempt = await requestResult(store.get(['attempt', id]));
    if (activeId !== id || !attempt || attempt.outcome !== 'unfinished') throw new AttemptStateError();
    const result = applyKlondikeAction(attempt.board, attempt.options.draw, action);
    const previousBoard = attempt.board;
    attempt.board = result.board;
    attempt.score += result.scoreDelta;
    attempt.moves += 1;
    attempt.elapsedMs = Math.max(attempt.elapsedMs, elapsedMs);
    if (result.won) {
      attempt.outcome = 'won';
      attempt.finishedAt = Date.now();
      await requestResult(store.delete(IDBKeyRange.bound(['undo', id], ['undo', id, []])));
      await requestResult(store.delete(ACTIVE_KEY));
      await requestResult(transaction.objectStore(APPLICATION_STORE).put('#/games/klondike', 'last-route'));
    } else {
      await requestResult(store.add({ board: previousBoard, scoreDelta: result.scoreDelta },
        ['undo', id, attempt.moves]));
    }
    await requestResult(store.put(attempt, ['attempt', id]));
    return attempt;
  });
}

/**
 * @param {IDBDatabase} database
 * @param {{ id: string, elapsedMs: number }} input
 * @returns {Promise<Object>}
 */
export function undoAttemptAction(database, { id, elapsedMs }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new TypeError('The attempt elapsed time must be valid.');
  }
  return withTransaction(database, [KLONDIKE_STORE], 'readwrite', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const activeId = await requestResult(store.get(ACTIVE_KEY));
    const attempt = await requestResult(store.get(['attempt', id]));
    if (activeId !== id || !attempt || attempt.outcome !== 'unfinished') throw new AttemptStateError();
    const cursor = await requestResult(store.openCursor(
      IDBKeyRange.bound(['undo', id], ['undo', id, []]), 'prev'));
    if (!cursor) throw new AttemptStateError();
    attempt.board = cursor.value.board;
    attempt.score -= cursor.value.scoreDelta + 1;
    attempt.moves += 1;
    attempt.elapsedMs = Math.max(attempt.elapsedMs, elapsedMs);
    await requestResult(cursor.delete());
    await requestResult(store.put(attempt, ['attempt', id]));
    return attempt;
  });
}

/**
 * @param {IDBDatabase} database
 * @param {{ id: string, elapsedMs: number }} input
 * @returns {Promise<Object>}
 */
export function forfeitAttempt(database, { id, elapsedMs }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new TypeError('The attempt elapsed time must be valid.');
  }
  return withTransaction(database, [APPLICATION_STORE, KLONDIKE_STORE], 'readwrite', async transaction => {
    const store = transaction.objectStore(KLONDIKE_STORE);
    const activeId = await requestResult(store.get(ACTIVE_KEY));
    const attempt = await requestResult(store.get(['attempt', id]));
    if (activeId !== id || !attempt || attempt.outcome !== 'unfinished') {
      throw new AttemptStateError();
    }
    attempt.outcome = 'forfeit';
    attempt.elapsedMs = Math.max(attempt.elapsedMs, elapsedMs);
    attempt.finishedAt = Date.now();
    await requestResult(store.put(attempt, ['attempt', id]));
    await requestResult(store.delete(IDBKeyRange.bound(['undo', id], ['undo', id, []])));
    await requestResult(store.delete(ACTIVE_KEY));
    await requestResult(transaction.objectStore(APPLICATION_STORE).put('#/games/klondike', 'last-route'));
    return attempt;
  });
}
