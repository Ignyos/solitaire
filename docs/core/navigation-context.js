/** @module Persisting the last stable application route */

import { APPLICATION_STORE, requestResult, withTransaction } from './storage.js?v=2026-11-28-00-39';

/**
 * @param {IDBDatabase} database
 * @returns {Promise<string | undefined>}
 */
export function readLastRoute(database) {
  return withTransaction(database, [APPLICATION_STORE], 'readonly', transaction =>
    requestResult(transaction.objectStore(APPLICATION_STORE).get('last-route')));
}

/**
 * @param {IDBDatabase} database
 * @param {string} route
 * @returns {Promise<void>}
 */
export function saveLastRoute(database, route) {
  return withTransaction(database, [APPLICATION_STORE], 'readwrite', async transaction => {
    await requestResult(transaction.objectStore(APPLICATION_STORE).put(route, 'last-route'));
  });
}
